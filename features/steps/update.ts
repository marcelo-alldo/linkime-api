import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const subscriptionMiddleware = (await subscription(authorization.data.masterUid)) as {
    success: boolean;
  };
  const { position, name } = JSON.parse(event.body || "{}");
  const { uid } = event.pathParameters || {};

  try {
    if (!authorization) {
      console.error("STEP UPDATE ERROR: Não autorizado: token de autenticação ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: token de autenticação ausente ou inválido.",
        }),
      };
    }

    if (!subscriptionMiddleware.success) {
      console.error("STEP UPDATE ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    // Busca o step atual
    const currentStep = await database.client.step.findUnique({ where: { uid } });

    if (!currentStep) {
      console.error("STEP UPDATE ERROR: Etapa não encontrada.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Etapa não encontrada.",
        }),
      };
    }

    // Atualização de nome
    if (name && name !== currentStep.name) {
      const updated = await database.client.step.update({
        where: { uid },
        data: { name },
      });
      console.log("STEP UPDATE SUCCESS: Nome da etapa atualizado com sucesso.");
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: updated,
          msg: "Nome da etapa atualizado com sucesso.",
        }),
      };
    }

    // Atualização de posição
    if (typeof position === "number" && position !== currentStep.position) {
      // Busca todos os steps do usuário
      const steps = await database.client.step.findMany({
        where: {
          OR: [{ userUid: null }, { userUid: authorization.data.masterUid }],
        },
        orderBy: { position: "asc" },
      });
      // Atualiza posições dos steps afetados
      const oldPosition = currentStep.position;
      const newPosition = position;
      let updates: Promise<any>[] = [];
      if (newPosition > oldPosition) {
        // Moveu para baixo: decrementa os steps entre old+1 e new
        updates = steps
          .filter((s) => s.position > oldPosition && s.position <= newPosition)
          .map((s) =>
            database.client.step.update({
              where: { uid: s.uid },
              data: { position: s.position - 1 },
            })
          );
      } else {
        // Moveu para cima: incrementa os steps entre new e old-1
        updates = steps
          .filter((s) => s.position >= newPosition && s.position < oldPosition)
          .map((s) =>
            database.client.step.update({
              where: { uid: s.uid },
              data: { position: s.position + 1 },
            })
          );
      }
      // Atualiza o step alvo
      await Promise.all([...updates, database.client.step.update({ where: { uid }, data: { position: newPosition } })]);
      console.log("STEP UPDATE SUCCESS: Posição da etapa atualizada com sucesso.");
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          msg: "Posição da etapa atualizada com sucesso.",
        }),
      };
    }
  } catch (error) {
    console.error("STEP UPDATE ERROR: Falha ao atualizar etapa.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao atualizar etapa. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
