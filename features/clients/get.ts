import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };

  console.log("AUTHORIZATION", authorization);

  try {
    if (!authorization) {
      console.error(
        "CLIENT GET ERROR: Cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    console.log("Authenticated user UID:", authorization.data.userUid);

    const page = event.queryStringParameters?.page
      ? parseInt(event.queryStringParameters.page, 10)
      : 1;
    const pageSize = event.queryStringParameters?.pageSize
      ? parseInt(event.queryStringParameters.pageSize, 10)
      : 10;
    const skip = (page - 1) * pageSize;
    const take = pageSize;
    console.log(
      `Pagination - page: ${page}, pageSize: ${pageSize}, skip: ${skip}, take: ${take}`
    );

    const uid = event.queryStringParameters?.uid;
    if (uid) {
      console.log("Fetching single client by uid:", uid);
      const client = await database.client.client.findFirst({
        where: {
          userUid: authorization?.data?.masterUid,
          uid,
        },
        include: {
          clientProfile: true,
          address: {
            include: {
              city: true,
            },
          },
          step: true,
          clientTags: {
            include: {
              tag: true
            }
          }
        },
      });
      if (!client) {
        console.error("CLIENT GET ERROR: Cliente não encontrado.");
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            msg: "Cliente não encontrado.",
          }),
        };
      }
      console.log(
        "CLIENT GET SUCCESS: Cliente recuperado com sucesso.",
        client
      );
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: client,
          msg: "Cliente recuperado com sucesso.",
        }),
      };
    }

    const search = event.queryStringParameters?.search;
    const numbersOnly = search ? search.replace(/\D/g, "") : "";
    const masterUid = authorization.data.masterUid;

    let data: any[];
    let total: number;

    // Se a busca parece ser um telefone (8+ dígitos), usa query raw
    if (numbersOnly.length >= 8) {
      console.log('BUSCA POR TELEFONE');
      console.log("Buscando por telefone normalizado:", numbersOnly);

      const phoneVariations: string[] = [];

      // Se tem 10 dígitos (ex: 5184406522)
      if (numbersOnly.length === 10 && numbersOnly.length >= 2) {
        phoneVariations.push(numbersOnly);
        phoneVariations.push(
          numbersOnly.slice(0, 2) + "9" + numbersOnly.slice(2)
        );
      }
      // Se tem 11 dígitos (ex: 51984406522)
      else if (numbersOnly.length === 11 && numbersOnly[2] === "9") {
        phoneVariations.push(numbersOnly);
        phoneVariations.push(numbersOnly.slice(0, 2) + numbersOnly.slice(3));
      }
      // Para outros tamanhos, busca apenas o número digitado
      else {
        phoneVariations.push(numbersOnly);
      }

      console.log("Variações de busca:", phoneVariations);

      const phoneConditions = phoneVariations
        .map(
          () =>
            `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(dc.phone, '(', ''), ')', ''), '-', ''), ' ', ''), '.', '') LIKE ?`
        )
        .join(" OR ");

      const queryParams = phoneVariations.map((v) => `%${v}%`);

      const rawClients = await database.client.$queryRawUnsafe(
        `
        SELECT 
          c.uid,
          c.owner_uid,
          dc.uid as clientProfileUid,
          dc.name, 
          dc.phone, 
          dc.email
        FROM \`clients\` c
        INNER JOIN \`data_clients\` dc ON c.data_client_uid = dc.uid
        WHERE c.user_uid = ? AND (${phoneConditions})
        ORDER BY dc.name ASC
        LIMIT ${take}
        OFFSET ${skip}
      `,
        masterUid,
        ...queryParams
      );

      // Buscar clientes completos com todas as relações usando Prisma
      const clientUids = (rawClients as any[]).map(client => client.uid);
      
      if (clientUids.length > 0) {
        data = await database.client.client.findMany({
          where: {
            uid: {
              in: clientUids
            }
          },
          select: {
            uid: true,
            enable: true,
            archived: true,
            step: true,
            clientProfile: true,
            clientTags: {
              include: {
                tag: true
              }
            }
          },
          orderBy: {
            clientProfile: {
              name: 'asc',
            }
          }
        });
      } else {
        data = [];
      }

      // Query para contar total
      const countResult = await database.client.$queryRawUnsafe<
        [{ count: bigint }]
      >(
        `
        SELECT COUNT(*) as count
        FROM \`clients\` c
        INNER JOIN \`data_clients\` dc ON c.data_client_uid = dc.uid
        WHERE c.user_uid = ? AND (${phoneConditions})
      `,
        masterUid,
        ...queryParams
      );

      total = Number(countResult[0].count);
    }
    // Busca normal por nome, email
    else {
      const where: any = {};
      where.userUid = masterUid;

      if (search) {
        console.log("Termo de busca recebido:", search);
        where.OR = [
          { clientProfile: { name: { contains: search } } },
          { clientProfile: { email: { contains: search } } },
        ];
        console.log("Condições de busca:", JSON.stringify(where, null, 2));
      }

      [data, total] = await Promise.all([
        database.client.client.findMany({
          where,
          select: {
            uid: true,
            enable: true,
            archived: true,
            step: true,
            clientProfile: true,
            clientTags: {
              include: {
                tag: true
              }
            }
          },
          orderBy: {
            clientProfile: {
              name: "asc",
            },
          },
          skip,
          take,
        }),
        database.client.client.count({
          where,
        }),
      ]);
    }

    console.log("Resultados encontrados:", data.length, "de", total, "total");

    const totalPages = Math.ceil(total / pageSize);
    console.log("Total pages:", totalPages);

    console.log("CLIENT GET SUCCESS: Clientes recuperados com sucesso.", data);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data,
        total,
        page,
        pageSize,
        totalPages,
        msg: "Clientes recuperados com sucesso.",
      }),
    };
  } catch (error) {
    console.error("Full error:", error);
    console.error("CLIENT GET ERROR: Falha ao recuperar clientes.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao recuperar clientes. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};