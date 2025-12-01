import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const leads = event.queryStringParameters?.leads || "";
  const clients = event.queryStringParameters?.clients || "";
  // const leadPageSize = event.queryStringParameters?.leadPageSize || "";

  try {
    if (!authorization) {
      console.error(
        "STEP GET ERROR: Não autorizado: token de autenticação ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: token de autenticação ausente ou inválido.",
        }),
      };
    }

    let include: {} = {};

    if (leads === "true") {
      // Paginação dos leads dentro do step (apenas pageSize)
      // const leadTake = leadPageSize ? parseInt(leadPageSize, 10) : 10;
      // console.log(`Pagination for leads - leadPageSize: ${leadTake}`);

      include = {
        leads: {
          where: {
            userUid: authorization.data.masterUid,
          },
          include: {
            owner: {
              select: {
                profile: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            leadTags: {
              select: { tag: { select: { uid: true, name: true, color: true } } },
            },
          },
          orderBy: {
            position: "asc",
          },
          // take: leadTake,
        },
      };
    }

    if (clients === "true") {
      include = {
        clients: {
          where: {
            userUid: authorization.data.masterUid,
          },
          include: {
            clientProfile: {
              select: {
                name: true,
                phone: true,
                notes: true
              },
            },
            owner: {
              select: {
                profile: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            clientTags: {
              select: { tag: { select: { uid: true, name: true, color: true } } },
            },
          },
          orderBy: {
            position: "asc",
          },
        },
      };
    }

    console.log(
      include,
      "INCLUDE ------------------------------------------------------------------------------------------"
    );

    let where: any = {};

    if (clients === "true") {
      where = {
        OR: [{ userUid: null }, { userUid: authorization.data.masterUid }],
        stepType: "CLIENT",
      };
    } else {
      where = {
        OR: [{ userUid: null }, { userUid: authorization.data.masterUid }],
        stepType: "LEAD",
      };
    }

    console.log("WHERE ------------------------", where);

    const data = await database.client.step.findMany({
      where,
      include,
      orderBy: {
        position: "asc",
      },
    });

    console.log("STEP GET SUCCESS: Etapas recuperadas com sucesso.");
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data,
        msg: "Etapas recuperadas com sucesso.",
      }),
    };
  } catch (error) {
    console.error("STEP GET ERROR: Falha ao recuperar etapas.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao recuperar etapas. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
