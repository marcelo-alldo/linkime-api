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
  const { message, newRecipients, sendAt, title, messageTemplateUid } = JSON.parse(event.body || "{}");
  // LOG: Received parameters
  console.log("Received parameters:", {
    message,
    sendAt,
    newRecipients,
    title,
    messageTemplateUid
  });

  // LOG: Authenticated user UID
  console.log("Authenticated user UID:", authorization.data.userUid);

  try {
    if (!authorization) {
      console.error("Scheduled Messages CREATE ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (!subscriptionMiddleware.success) {
      console.error("Scheduled Messages CREATE ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    if (!message || !newRecipients) {
      console.error("Scheduled Messages CREATE ERROR: Campos obrigatórios não informados (mensagem, destinatários).");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Requisição inválida: Campos obrigatórios não informados (mensagem, destinatários).",
        }),
      };
    }

    const result = await database.client.$transaction(async (prisma) => {
      const masterUser = await prisma.user.findUnique({
        where: { uid: authorization.data.masterUid },
      });

      const createdMessage = await prisma.scheduledMessage.create({
        data: {
          message: message || "",
          instance: masterUser?.login || "",
          userUid: masterUser?.uid || "",
          sendAt: new Date(sendAt),
          title: title || "",
          messageTemplateUid: messageTemplateUid || "",
        },
      });

      await prisma.scheduledMessageRecipient.createMany({
        data: newRecipients.map((recipient: any) => ({
          scheduledMessageUid: createdMessage.uid,
          remoteJid: recipient.remoteJid,
          name: recipient.name,
          leadUid: recipient.leadUid || null,
          clientUid: recipient.clientUid || null,
        })),
      });

      console.log("Scheduled message created successfully.", createdMessage);

      return { createdMessage };
    });

    // LOG: Client created successfully
    console.log("SCHEDULED MESSAGE SUCCESS: Mensagens criadas com sucesso.", result);
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        msg: "Mensagens agendadas com sucesso.",
      }),
    };
  } catch (error) {
    // LOG: Full error
    console.error("SCHEDULED MESSAGES CREATE ERROR: Falha ao criar mensagens.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao agendar mensagens. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
