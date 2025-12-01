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

    // LOG: Authenticated user UID
    console.log("Authenticated user UID:", authorization.data.userUid);

    // Pagination from queryStringParameters
    const page = event.queryStringParameters?.page
      ? parseInt(event.queryStringParameters.page, 10)
      : 1;
    const pageSize = event.queryStringParameters?.pageSize
      ? parseInt(event.queryStringParameters.pageSize, 10)
      : 10;
    const skip = (page - 1) * pageSize;
    const take = pageSize;
    console.log(
      `Pagination - page: ${page}, paeSize: ${pageSize}, skip: ${skip}, take: ${take}`
    );

    // Check if uid is provided in queryStringParameters
    let getRecipients = true;
    const getClients = event.queryStringParameters?.clients;
    const getLeads = event.queryStringParameters?.leads;
    const scheduledMessageUid = event.queryStringParameters?.message;

    if (getClients || getLeads) {
      getRecipients = false;
      console.log("Fetching recipients for clients or leads.");
    }

    const search = event.queryStringParameters?.search;
    console.log("Search query:", search);

    const where: any = {};

    if (getClients) {
      where.userUid = authorization.data.masterUid;
      
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { remoteJid: { contains: search } },
        ];
      }

      const [data, total] = await Promise.all([
        database.client.client.findMany({
          where,
          include: {
            scheduledMessageRecipients: {
              where: {
                scheduledMessageUid: scheduledMessageUid,
              },
            },
            clientProfile: true,
          },
          skip,
          take,
        }),
        database.client.client.count({
          where,
        }),
      ]);

      const totalPages = Math.ceil(total / pageSize);
      // LOG: Total pages
      console.log("Total pages:", totalPages);

      // LOG: Clients retrieved
      console.log("Scheduled Messages CLients retrieved:", data);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data,
          total: data.length,
          page,
          pageSize,
          totalPages,
          msg: "Contatos recuperados com sucesso.",
        }),
      };
    }
    if (getLeads) {
      where.userUid = authorization.data.masterUid;
      
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
        ];
      }

      const [data, total] = await Promise.all([
        database.client.lead.findMany({
          where,
          include: {
            scheduledMessageRecipients: {
              where: {
                scheduledMessageUid: scheduledMessageUid,
              },
            },
            step: true,
          },
          orderBy: {
            name: 'asc',
          },
          skip,
          take,
        }),
        database.client.lead.count({
          where,
        }),
      ]);

      const totalPages = Math.ceil(total / pageSize);
      // LOG: Total pages
      console.log("Total pages:", totalPages);

      // LOG: Clients retrieved
      console.log("Scheduled Messages Leads retrieved:", data);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data,
          total: data.length,
          page,
          pageSize,
          totalPages,
          msg: "Contatos recuperados com sucesso.",
        }),
      };
    }

    if (getRecipients) {
      where.scheduledMessage = {
        userUid: authorization.data.masterUid,
        uid: scheduledMessageUid,
      };
      where.AND = [{ leadUid: null }, { clientUid: null }];
      
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { remoteJid: { contains: search } },
        ];
      }
    }

    console.log("Where clause for scheduled messages recipients:", where);

    const [data, total] = await Promise.all([
      database.client.scheduledMessageRecipient.findMany({
        where,
        skip,
        take,
        include: {
          lead: { select: { uid: true } },
          client: { select: { uid: true } },
          scheduledMessage: true,
        },
      }),
      database.client.scheduledMessageRecipient.count({
        where,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);
    // LOG: Total pages
    console.log("Total pages:", totalPages);

    // LOG: Clients retrieved
    console.log("Scheduled Messages Recipients retrieved:", data);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data,
        total: data.length,
        page,
        pageSize,
        totalPages,
        msg: "Contatos recuperados com sucesso.",
      }),
    };
  } catch (error) {
    // LOG: Full error
    console.error("Full error:", error);
    console.error(
      "SCHEDULED MESSAGES RECIPIENTS GET ERROR: Falha ao recuperar contatos.",
      error
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao recuperar contatos. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
