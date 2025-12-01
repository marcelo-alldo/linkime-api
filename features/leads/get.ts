import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };

  try {
    if (!authorization) {
      console.error(
        "LEAD GET ERROR: Cabeçalho de autorização ausente ou inválido."
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
      console.log("Fetching single lead by uid:", uid);
      const lead = await database.client.lead.findFirst({
        where: {
          userUid: authorization?.data?.masterUid,
          uid,
        },
        include: {
          step: true,
          leadTags: {
            include: {
              tag: true,
            },
          },
        },
      });
      if (!lead) {
        console.error("LEAD GET ERROR: Lead não encontrado.");
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            msg: "Lead não encontrado.",
          }),
        };
      }
      console.log("LEAD GET SUCCESS: Lead recuperado com sucesso.", lead);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: lead,
          msg: "Lead recuperado com sucesso.",
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
      console.log("BUSCA POR TELEFONE");
      console.log("Buscando por telefone normalizado:", numbersOnly);

      // Sempre busca pelas duas variações: com e sem o 9 após o DDD
      const phoneVariations: string[] = [];

      // Se tem 12 dígitos (ex: 555184406522)
      if (numbersOnly.length === 12) {
        if (numbersOnly.startsWith("55")) {
          const withoutCountry = numbersOnly.slice(2);
          phoneVariations.push(withoutCountry); // sem 55: 5184406522
          if (withoutCountry.length >= 2) {
            phoneVariations.push(
              withoutCountry.slice(0, 2) + "9" + withoutCountry.slice(2)
            ); // com 9: 51984406522
          }
        } else {
          phoneVariations.push(numbersOnly);
        }
      }
      // Se tem 10 dígitos (ex: 5184406522)
      else if (numbersOnly.length === 10 && numbersOnly.length >= 2) {
        phoneVariations.push(numbersOnly); // versão original: 5184406522
        phoneVariations.push(
          numbersOnly.slice(0, 2) + "9" + numbersOnly.slice(2)
        ); // com 9: 51984406522
      }
      // Se tem 11 dígitos (ex: 51984406522)
      else if (numbersOnly.length === 11 && numbersOnly[2] === "9") {
        phoneVariations.push(numbersOnly); // versão original: 51984406522
        phoneVariations.push(numbersOnly.slice(0, 2) + numbersOnly.slice(3)); // sem 9: 5184406522
      }
      // Para outros tamanhos, busca apenas o número digitado
      else {
        phoneVariations.push(numbersOnly);
      }

      console.log("Variações de busca:", phoneVariations);

      // Monta a condição WHERE com todas as variações usando OR
      const phoneConditions = phoneVariations
        .map(
          () =>
            `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '(', ''), ')', ''), '-', ''), ' ', ''), '.', '') LIKE ?`
        )
        .join(" OR ");

      // Inclui filtro de masterUid (user_uid)
      const whereClause = `user_uid = ? AND (${phoneConditions})`;

      // Query para buscar leads com todas as variações
      const queryParamsWithUid = [
        masterUid,
        ...phoneVariations.map((v) => `%${v}%`),
      ];

      const rawLeads = await database.client.$queryRawUnsafe(
        `
        SELECT 
          uid, 
          name, 
          phone, 
          email,
          owner_uid AS ownerUid
        FROM \`leads\`
        WHERE ${whereClause}
        ORDER BY name ASC
        LIMIT ${take}
        OFFSET ${skip}
      `,
        ...queryParamsWithUid
      );

      // Buscar leads completos com todas as relações usando Prisma
      const leadUids = (rawLeads as any[]).map((lead) => lead.uid);

      if (leadUids.length > 0) {
        data = await database.client.lead.findMany({
          where: {
            uid: {
              in: leadUids,
            },
          },
          select: {
            uid: true,
            name: true,
            phone: true,
            email: true,
            ownerUid: true,
            archived: true,
            leadTags: {
              include: {
                tag: true,
              },
            },
            notes: true,
          },
          orderBy: {
            name: "asc",
          },
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
        FROM \`leads\`
        WHERE ${whereClause}
      `,
        ...queryParamsWithUid
      );

      total = Number(countResult[0].count);
    } else {
      const where: any = {
        userUid: masterUid,
      };

      if (search) {
        console.log("Termo de busca recebido:", search);
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
        ];
        console.log("Condições de busca:", JSON.stringify(where, null, 2));
      }

      [data, total] = await Promise.all([
        database.client.lead.findMany({
          where,
          select: {
            uid: true,
            name: true,
            phone: true,
            email: true,
            ownerUid: true,
            archived: true,
            step: true,
            leadTags: {
              include: {
                tag: true,
              },
            },
          },
          orderBy: {
            name: "asc",
          },
          skip,
          take,
        }),
        database.client.lead.count({
          where,
        }),
      ]);
    }

    console.log("Resultados encontrados:", data.length, "de", total, "total");

    const totalPages = Math.ceil(total / pageSize);
    console.log("Total pages:", totalPages);

    console.log("LEAD GET SUCCESS: Leads recuperados com sucesso.", data);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data,
        total,
        page,
        pageSize,
        totalPages,
        msg: "Leads recuperados com sucesso.",
      }),
    };
  } catch (error) {
    console.error("LEAD GET ERROR: Falha ao recuperar leads.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao recuperar leads. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
