import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };

  try {
    if (!authorization) {
      console.error("COLLABORATOR GET ERROR: Cabeçalho de autorização ausente ou inválido.");
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
    console.log(`Pagination - page: ${page}, pageSize: ${pageSize}, skip: ${skip}, take: ${take}`);

    // Check if uid is provided in queryStringParameters
    const uid = event.queryStringParameters?.uid;
    if (uid) {
      // LOG: Fetching single collaborator by uid
      console.log("Fetching single collaborator by uid:", uid);
      const collaborator = await database.client.collaborator.findFirst({
        where: {
          parentUid: authorization?.data?.masterUid,
          uid,
        },
        include: {
          user: {
            select: {
              uid: true,
              enable: true,
              profile: true,
            },
          },
        },
      });
      if (!collaborator) {
        console.error("COLLABORATOR GET ERROR: Colaborador não encontrado.");
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            msg: "Colaborador não encontrado.",
          }),
        };
      }
      // LOG: Single collaborator retrieved
      console.log("Single collaborator retrieved:", collaborator);
      console.log("COLLABORATOR GET SUCCESS: Colaborador recuperado com sucesso.", collaborator);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: collaborator,
          msg: "Colaborador recuperado com sucesso.",
        }),
      };
    }

    // Filtro por nome, email ou telefone
    const search = event.queryStringParameters?.search;
    const where: any = {};
    where.parentUid = authorization.data.masterUid;

    if (search) {
      where.OR = [
        { user: { profile: { name: { contains: search } } } },
        { user: { profile: { email: { contains: search } } } },
        { user: { profile: { phone: { contains: search } } } },
      ];
    }

    const [data, total] = await Promise.all([
      database.client.collaborator.findMany({
        where,
        include: {
          user: {
            select: {
              uid: true,
              enable: true,
              profile: true,
            },
          },
        },
        skip,
        take,
      }),
      database.client.collaborator.count({
        where,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);
    // LOG: Total pages
    console.log("Total pages:", totalPages);

    // LOG: Collaborators retrieved
    console.log("Collaborators retrieved:", data);
    console.log("COLLABORATOR GET SUCCESS: Colaboradores recuperados com sucesso.", data);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data,
        total,
        page,
        pageSize,
        totalPages,
        msg: "Colaboradores recuperados com sucesso.",
      }),
    };
  } catch (error) {
    console.error("COLLABORATOR GET ERROR: Falha ao recuperar colaboradores.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao recuperar colaboradores. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
