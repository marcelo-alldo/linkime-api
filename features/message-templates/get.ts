import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };

  try {
    if (!authorization) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    // Pagination from queryStringParameters
    const page = event.queryStringParameters?.page ? parseInt(event.queryStringParameters.page, 10) : 1;
    const pageSize = event.queryStringParameters?.pageSize ? parseInt(event.queryStringParameters.pageSize, 10) : 10;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Check if uid is provided in queryStringParameters
    const uid = event.queryStringParameters?.uid;
    if (uid) {
      const template = await database.client.messageTemplate.findMany({
        where: {
          userUid: authorization?.data?.masterUid,
          uid,
        },
      });

      if (!template) {
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            msg: "Template não encontrado.",
          }),
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: template,
          msg: "Template recuperado com sucesso.",
        }),
      };
    }

    const search = event.queryStringParameters?.search;
    const where: any = {};
    where.userUid = authorization.data.masterUid;

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { message: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      database.client.messageTemplate.findMany({
        where,
        skip,
        take,
        select: {
          uid: true,
          name: true,
          message: true,
          category: true,
          enable: true,
          status: true,
          createdAt: true,
        },
      }),
      database.client.messageTemplate.count({
        where,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data,
        total: data.length,
        page,
        pageSize,
        totalPages,
        msg: "Templates recuperados com sucesso.",
      }),
    };
  } catch (error) {
    console.error("MESSAGE TEMPLATES GET ERROR:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao recuperar templates. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};