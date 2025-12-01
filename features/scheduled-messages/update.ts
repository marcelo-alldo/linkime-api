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
  // Parse all possible fields from body
  const { enable, newRecipients, removedRecipients, title, sendAt, message } = JSON.parse(event.body || "{}");
  const { uid } = event.pathParameters || {};
  // LOG: Received parameters
  console.log("Received parameters:", {
    enable,
    newRecipients,
    removedRecipients,
    title,
    sendAt,
    message,
  });

  try {
    if (!authorization) {
      console.error("SCHEDULED MESSAGES UPDATE ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (!subscriptionMiddleware.success) {
      console.error("SCHEDULED MESSAGES UPDATE ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    if (!uid) {
      console.error("SCHEDULED MESSAGES UPDATE ERROR: Campo obrigatório não informado (uid).");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Requisição inválida: Campo obrigatório não informado (uid).",
        }),
      };
    }

    // LOG: Updating client profile with uid
    console.log("Updating scheduled-message with uid:", uid);

    // Find the client to get the dataClientUid
    const scheduledMessage = await database.client.scheduledMessage.findUnique({
      where: { uid },
      select: { uid: true, enable: true },
    });
    if (!scheduledMessage) {
      console.error("SCHEDULED MESSAGE UPDATE ERROR: Mensagem não encontrado.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Mensagem não encontrada.",
        }),
      };
    }

    // Update the Client ENABLE
    if (typeof enable === "boolean") {
      // LOG: Toggling enable for client with uid
      console.log("Toggling enable for scheduled-message with uid:", uid);
      const updatedClient = await database.client.scheduledMessage.update({
        where: { uid },
        data: { enable: !scheduledMessage.enable },
      });
      // LOG: Client enable toggled
      console.log(
        "SCHEDULED MESSAGE UPDATE SUCCESS: Status de enable da mensagem alterada com sucesso.",
        updatedClient
      );
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          msg: "Status de enable da mensagem alterada com sucesso.",
          data: updatedClient,
        }),
      };
    }

    // LOG: Updating scheduled message with uid
    console.log("Updating scheduled message with uid:", uid);

    // Use transaction to handle recipients updates
    await database.client.$transaction(async (prisma) => {
      // First, remove recipients if removedRecipients is provided
      if (removedRecipients && Array.isArray(removedRecipients) && removedRecipients.length > 0) {
        await prisma.scheduledMessageRecipient.deleteMany({
          where: {
            scheduledMessageUid: uid,
            uid: {
              in: removedRecipients,
            },
          },
        });
        console.log("Removed recipients:", removedRecipients);
      }

      // Then, handle recipients - find current ones and add only new ones
      if (newRecipients && Array.isArray(newRecipients)) {
        // Get all current recipients for this scheduledMessage

        console.log("New recipients to add:", newRecipients);
        // Create only the new recipients
        if (newRecipients.length > 0) {
          const recipientsToCreate = newRecipients.map((recipient: any) => ({
            scheduledMessageUid: uid,
            remoteJid: recipient.remoteJid,
            name: recipient.name,
            ...(recipient.clientUid && { clientUid: recipient.clientUid }),
            ...(recipient.leadUid && { leadUid: recipient.leadUid }),
          }));

          await prisma.scheduledMessageRecipient.createMany({
            data: recipientsToCreate,
          });
          console.log("Created new recipients:", recipientsToCreate);
        }
      }

      // Finally, update the scheduled message
      return await prisma.scheduledMessage.update({
        where: { uid },
        data: {
          ...(title && { title }),
          ...(sendAt && { sendAt: new Date(sendAt) }),
          ...(message && { message }),
        },
      });
    });

    console.log("SCHEDULED MESSAGES UPDATE SUCCESS: Cliente atualizado com sucesso.");
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Mesagem atualizada com sucesso.",
      }),
    };
  } catch (error) {
    // LOG: Full error
    console.error("SCHEDULED MESSAGES UPDATE ERROR: Falha ao atualizar cliente.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao atualizar mensagem. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
