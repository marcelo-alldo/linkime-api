import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();

  try {
    const authorization = (await auth(event)) as { success: boolean; data: any };
    if (!authorization?.success) {
      console.error("STEP CREATE ERROR: Não autorizado: token de autenticação ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: token de autenticação ausente ou inválido.",
        }),
      };
    }

    const subscriptionMiddleware = (await subscription(authorization.data.masterUid)) as {
      success: boolean;
    };
    if (!subscriptionMiddleware.success) {
      console.error("STEP CREATE ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    const { name, type } = JSON.parse(event.body || "{}");

    if (!name) {
      console.error("STEP CREATE ERROR: Campo obrigatório não informado (nome da etapa).");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Campo obrigatório não informado (nome da etapa).",
        }),
      };
    }

    // 🔹 Define o tipo da etapa
    const stepType = type === "clients" ? "CLIENT" : "LEAD";

    // 🔹 Busca o último step do mesmo tipo
    const lastStep = await database.client.step.findFirst({
      where: {
        OR: [{ userUid: null }, { userUid: authorization.data.masterUid }],
        stepType, // <--- Filtra pelo tipo
      },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    // 🔹 Define a próxima posição apenas dentro do grupo
    const position = lastStep ? lastStep.position + 1 : 1;

    await database.client.step.create({
      data: {
        name,
        type: "USER",
        position,
        stepType,
        user: {
          connect: {
            uid: authorization.data.masterUid,
          },
        },
      },
    });

    console.log("STEP CREATE SUCCESS: Etapa criada com sucesso.");
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        msg: "Etapa criada com sucesso.",
      }),
    };
  } catch (error) {
    console.error("STEP CREATE ERROR: Falha ao criar etapa.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao criar etapa. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
