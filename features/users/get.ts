import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };

  try {
    if (!authorization) {
      console.error("USER GET ERROR: Não autorizado: cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    const uid = event.queryStringParameters?.uid;
    if (uid) {
      // LOG: Fetching single user by uid
      console.log("Fetching single user by uid:", uid);
      const user = await database.client.user.findFirst({
        where: {
          uid,
        },
        select: {
          uid: true,
          enable: true,
          profileUid: true,
          partnerUid: true,
          createdAt: true,
          updatedAt: true,
          profile: true,
          subscriptions: true,
          collaborators: true,
          configs: {
            where: {
              key: { in: ["ABOUT", "ALLDO_STATUS", "PRODUCTS"] },
            },
          },
          _count: {
            select: {
              collaborators: true,
              leads: true,
              clients: true,
            },
          },
        },
      });
      if (!user) {
        console.error("USER GET ERROR: Usuário não encontrado.");
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            msg: "Usuário não encontrado.",
          }),
        };
      }
      // LOG: Single user retrieved
      console.log("USER GET SUCCESS: Usuário recuperado com sucesso.", user);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: user,
          msg: "Usuário recuperado com sucesso.",
        }),
      };
    }

    // Pagination from queryStringParameters
    const page = event.queryStringParameters?.page ? parseInt(event.queryStringParameters.page, 10) : 1;
    const pageSize = event.queryStringParameters?.pageSize ? parseInt(event.queryStringParameters.pageSize, 10) : 10;
    const skip = (page - 1) * pageSize;
    const take = pageSize;
    console.log(`Pagination - page: ${page}, pageSize: ${pageSize}, skip: ${skip}, take: ${take}`);

    // Filtro por nome, email ou telefone
    const search = event.queryStringParameters?.search;
    const where: any = {};

    where.type = 2;

    if (search) {
      where.OR = [{ profile: { name: { contains: search } } }, { uid: { contains: search } }];
    }

    const [data, total] = await Promise.all([
      database.client.user.findMany({
        where,
        select: {
          uid: true,
          enable: true,
          profileUid: true,
          partnerUid: true,
          createdAt: true,
          updatedAt: true,
          profile: true,
          collaborators: true,
        },
        skip,
        take,
      }),
      database.client.user.count({
        where,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);
    // LOG: Total pages
    console.log("Total pages:", totalPages);

    console.log("USER GET SUCCESS: Usuários recuperados com sucesso.", data);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data,
        total,
        page,
        pageSize,
        totalPages,
        msg: "Usuários recuperados com sucesso.",
      }),
    };
  } catch (error) {
    console.error("USER GET ERROR: Falha ao recuperar usuários.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao recuperar usuários. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
