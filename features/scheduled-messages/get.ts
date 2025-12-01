import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };

  console.log("AUTHORIZATION", authorization);

  try {
    if (!authorization) {
      console.error("CLIENT GET ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    // LOG: Authenticated user UID
    console.log("Authenticated user UID:", authorization.data.userUid);

    // Pagination from queryStringParameters
    const page = event.queryStringParameters?.page ? parseInt(event.queryStringParameters.page, 10) : 1;
    const pageSize = event.queryStringParameters?.pageSize ? parseInt(event.queryStringParameters.pageSize, 10) : 10;
    const skip = (page - 1) * pageSize;
    const take = pageSize;
    console.log(`Pagination - page: ${page}, paeSize: ${pageSize}, skip: ${skip}, take: ${take}`);

    // Check if uid is provided in queryStringParameters
    const uid = event.queryStringParameters?.uid;
    if (uid) {
      // LOG: Fetching single client by uid
      console.log("Fetching single scheduled message by uid:", uid);
      const message = await database.client.scheduledMessage.findMany({
        where: {
          userUid: authorization?.data?.masterUid,
          uid,
        },
      });

      if (!message) {
        console.error("SCHEDULED MESSAGE GET ERROR: Mensagem não encontrada.");
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            msg: "Mensagem não encontrada.",
          }),
        };
      }
      // LOG: Single scheduled message retrieved
      console.log("Single SCHEDULED MESSAGE retrieved:", message);

      const leadsRecipientsCount = await database.client.scheduledMessageRecipient.count({
        where: {
          scheduledMessageUid: message[0]?.uid,
          leadUid: {
            not: null,
          },
        },
      });

      const clientsRecipientsCount = await database.client.scheduledMessageRecipient.count({
        where: {
          scheduledMessageUid: message[0]?.uid,
          clientUid: {
            not: null,
          },
        },
      });

      const recipientsCount = await database.client.scheduledMessageRecipient.count({
        where: {
          scheduledMessageUid: message[0]?.uid,
          leadUid: {
            in: null,
          },
          clientUid: {
            in: null,
          },
        },
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: message,
          leadsRecipientsCount,
          clientsRecipientsCount,
          recipientsCount,
          msg: "Mensagem recuperada com sucesso.",
        }),
      };
    }

    const search = event.queryStringParameters?.search;
    console.log("Search query:", search);

    const where: any = {};
    where.userUid = authorization.data.masterUid;

    if (search) {
      where.OR = [{ message: { contains: search } }];
    }

    console.log("Where clause for scheduled messages:", where);

    const [data, total] = await Promise.all([
      database.client.scheduledMessage.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take,
        select: {
          title: true,
          message: true,
          sendAt: true,
          uid: true,
          status: true,
          enable: true,
          _count: {
            select: { recipients: true },
          },
        },
      }),
      database.client.scheduledMessage.count({
        where,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);
    // LOG: Total pages
    console.log("Total pages:", totalPages);

    // LOG: Clients retrieved
    console.log("Scheduled Messages retrieved:", data);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data,
        total: data.length,
        page,
        pageSize,
        totalPages,
        msg: "Mensagens recuperadas com sucesso.",
      }),
    };
  } catch (error) {
    // LOG: Full error
    console.error("Full error:", error);
    console.error("SCHEDULED MESSAGES GET ERROR: Falha ao recuperar mensagens.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao recuperar mensagens. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
