import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const { uid } = event.pathParameters || {};
  const { stepUid, position } = JSON.parse(event.body || "");
  const subscriptionMiddleware = (await subscription(
    authorization.data.masterUid
  )) as {
    success: boolean;
  };

  try {
    if (!authorization) {
      console.error(
        "CLIENT CHANGE STEP ERROR: Cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (!subscriptionMiddleware.success) {
      console.error("CLIENT CHANGE STEP ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    if (!stepUid || !position || !uid) {
      console.error(
        "CLIENT CHANGE STEP ERROR: Campos obrigatórios não informados (stepUid, position, uid)."
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Campos obrigatórios não informados: stepUid, position e uid.",
        }),
      };
    }

    // LOG: Received parameters
    console.log(
      "Received stepUid:",
      stepUid,
      "position:",
      position,
      "uid:",
      uid
    );

    // Fetch current client to get origin step and old position
    const currentClient = await database.client.client.findUnique({
      where: { uid },
      select: { stepUid: true, position: true },
    });

    // LOG: Current client info
    console.log("Current client:", currentClient);

    if (!currentClient) {
      console.error("CLIENT CHANGE STEP ERROR: Cliente não encontrado.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Client não encontrado.",
        }),
      };
    }

    // ✅ NEW: Validate that position is not null
    if (currentClient.position === null || currentClient.position === undefined) {
      console.error("CLIENT CHANGE STEP ERROR: Cliente não possui posição definida.", {
        uid,
        currentClient
      });
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Cliente não possui posição definida. Por favor, corrija os dados antes de mover o cliente.",
        }),
      };
    }

    // ✅ Store the validated position in a const for TypeScript type narrowing
    const currentPosition: number = currentClient.position;
    const currentStepUid = currentClient.stepUid;

    console.log("Validated currentPosition:", currentPosition, "type:", typeof currentPosition);

    // LOG: Iniciando transação para atualizar posições e client
    const updatedClient = await database.client.$transaction(async (prisma) => {
      // Only update origin step positions if moving within different steps OR different positions
      if (currentStepUid !== stepUid || currentPosition !== position) {
        // LOG: Updating positions in origin step
        console.log("Updating origin step positions:", {
          stepUid: currentStepUid,
          currentPosition,
          positionGt: currentPosition,
        });
        
        // Only decrement if there are clients after the current position
        await prisma.client.updateMany({
          where: {
            stepUid: currentStepUid,
            position: { gt: currentPosition },
          },
          data: {
            position: { decrement: 1 },
          },
        });
      }

      // LOG: Updating positions in destination step
      console.log("Updating destination step positions:", {
        stepUid,
        position,
        positionGte: position,
      });
      await prisma.client.updateMany({
        where: {
          stepUid,
          position: { gte: position },
        },
        data: {
          position: { increment: 1 },
        },
      });

      // LOG: Updating client to new step and position
      console.log("Updating client:", { uid, position, stepUid });
      return await prisma.client.update({
        where: { uid },
        data: {
          position,
          step: {
            connect: { uid: stepUid },
          },
        },
      });
    });

    // LOG: updatedClient result
    console.log("updatedClient:", updatedClient);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: updatedClient,
        msg: "Client atualizado com sucesso.",
      }),
    };
  } catch (error) {
    console.error("CLIENT CHANGE STEP ERROR: Falha ao atualizar client.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao atualizar client. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};