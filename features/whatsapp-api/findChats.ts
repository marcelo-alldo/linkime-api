import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import axios from "axios";
import { subscription } from "../middlewares/subscription.middleware";
import { formatPhone } from "../../utils/formatPhone";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const subscriptionMiddleware = (await subscription(authorization.data.masterUid)) as {
    success: boolean;
  };
  const limit = event.queryStringParameters?.limit || 15;
  const remoteJid = event.queryStringParameters?.remoteJid;

  try {
    if (!authorization) {
      console.error("EVOLUTION FIND CHATS ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: token de autorização ausente ou inválido.",
        }),
      };
    }

    if (!subscriptionMiddleware.success) {
      console.error("EVOLUTION FIND CHATS ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    const user = await database.client.user.findUnique({
      where: {
        uid: authorization.data.masterUid,
      },
      select: {
        profile: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!user || !user.profile || !user.profile.email) {
      console.error("EVOLUTION FIND CHATS ERROR: Usuário não encontrado.");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Usuário não encontrado.",
        }),
      };
    }

    // LOG: Verificando valor do header Authorization
    console.log("Authorization header:", process.env.ALLDO_ASSISTENTE_APIKEY ? "[DEFINED]" : "[UNDEFINED]");

    let response;
    if (remoteJid) {
      response = await axios.post(
        `${process.env.ALLDO_ASSISTENTE_BASE_URL}/chat/findChats/${user.profile.email}`,
        {
          where: {
            remoteJid: remoteJid,
          },
        },
        {
          headers: {
            apikey: `${process.env.ALLDO_ASSISTENTE_APIKEY}`,
          },
        }
      );
    } else {
      response = await axios.post(
        `${process.env.ALLDO_ASSISTENTE_BASE_URL}/chat/findChats/${user.profile.email}`,
        {},
        {
          headers: {
            apikey: `${process.env.ALLDO_ASSISTENTE_APIKEY}`,
          },
        }
      );
    }

    const chatsFiltered = response.data.filter((chat: any) => chat.remoteJid.endsWith("@s.whatsapp.net"));

    const chatsFilteredWithSlice = chatsFiltered.slice(0, limit);

    let data: Array<{
      [key: string]: any;
      lastMessage: { key: any; message: any; timestamp: any } | null;
    }> = [];

    for (const chat of chatsFilteredWithSlice) {
      try {
        const response = await axios.post(
          `${process.env.ALLDO_ASSISTENTE_BASE_URL}/chat/findMessages/${user.profile.email}`,
          {
            where: {
              key: {
                remoteJid: chat.remoteJid,
              },
            },
            limit: 1,
            sort: "desc",
          },
          {
            headers: {
              apikey: `${process.env.ALLDO_ASSISTENTE_APIKEY}`,
            },
          }
        );

        console.log(
          `EVOLUTION FIND CHATS SUCCESS: Mensagens encontradas para o chat ${chat.remoteJid}.`,
          response.data
        );

        const countUnreadMessages = await database.client.tempMessage.count({
          where: {
            remoteJid: chat.remoteJid,
            fromMe: false,
            userUid: authorization.data.masterUid,
          },
        });

        console.log("EVOLUTION FIND CHATS LOG: Verificando se é lead ou cliente para o chat", chat.remoteJid);

        const isClient = await database.client.client.findFirst({
          where: {
            userUid: authorization.data.masterUid,
            clientProfile: {
              phone: formatPhone(chat.remoteJid.split("@")[0]),
            },
          },
          select: {
            clientProfile: {
              select: {
                name: true,
              },
            },
          },
        });

        let isLead;
        if (!isClient) {
          isLead = await database.client.lead.findFirst({
            where: {
              userUid: authorization.data.masterUid,
              phone: formatPhone(chat.remoteJid.split("@")[0]),
            },
            select: {
              name: true,
            },
          });
        }

        const attendantHistory = await database.client.attendantHistory.findMany({
          where: {
            remoteJid: chat.remoteJid,
            masterUid: authorization.data.masterUid,
          },
          include: {
            user: {
              select: {
                profile: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            userTransfered: {
              select: {
                profile: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            timestamp: "desc",
          },
        });

        console.log(
          `EVOLUTION FIND CHATS LOG: Mensagens não lidas encontradas para o chat ${chat.remoteJid}.`,
          countUnreadMessages
        );

        const records = response.data.messages?.records || [];

        const allItems = [
          ...records.map((msg) => ({
            type: "message",
            sortTimestamp: Number(msg.messageTimestamp),
            ...msg,
          })),
          ...attendantHistory.map((hist) => ({
            type: "attendantHistory",
            sortTimestamp: Number(hist.timestamp),
            ...hist,
            timestamp: Number(hist.timestamp), // garante que timestamp não será BigInt
            messageTimestamp: Number(hist.timestamp), // padroniza para messageTimestamp
          })),
        ];

        // Ordena todos pelo sortTimestamp (do menor para o maior)
        allItems.sort((a, b) => a.sortTimestamp - b.sortTimestamp);

        // Remove todos os attendantHistory do início do array
        while (allItems.length > 0 && allItems[0].type === "attendantHistory") {
          allItems.shift();
        }

        // Substitui o array original de records pelo array ordenado
        if (response.data.messages) {
          response.data.messages.records = allItems;

          // Mapeia mensagens excluídas para exibir "Esta mensagem foi excluída"
          if (Array.isArray(response.data.messages.records)) {
            response.data.messages.records = response.data.messages.records.map((msg) => {
              if (
                msg.type === "message" &&
                Array.isArray(msg.MessageUpdate) &&
                msg.MessageUpdate.length > 0 &&
                msg.MessageUpdate.some((u) => u.status === "DELETED")
              ) {
                return {
                  ...msg,
                  messageType: "conversation",
                  message: { conversation: "Esta mensagem foi excluída" },
                };
              }
              return msg;
            });
          }
        }

        response.data.messages.records.map((msg) => msg.MessageUpdate);

        if (response.data && response.data.messages.records.length > 0) {
          data.push({
            ...chat,
            messages: response.data.messages,
            unreadMessages: countUnreadMessages,
            pushName: isLead ? isLead.name : isClient ? isClient.clientProfile.name : chat.pushName,
            isLead: isLead ? true : false,
            isClient: isClient ? true : false,
            attendant:
              attendantHistory.length > 0
                ? { uid: attendantHistory[0].userUid, name: attendantHistory[0].user?.profile?.name }
                : null,
            isMine: attendantHistory.length > 0 ? attendantHistory[0].userUid === authorization.data.userUid : false,
            attendantStatus: attendantHistory.length > 0 ? attendantHistory[0].status : null,
          });
        } else {
          data.push({
            ...chat,
            messages: null,
            unreadMessages: countUnreadMessages,
            pushName: isLead ? isLead.name : isClient ? isClient.clientProfile.name : chat.pushName,
            isLead: isLead ? true : false,
            isClient: isClient ? true : false,
            attendant:
              attendantHistory.length > 0
                ? { uid: attendantHistory[0].userUid, name: attendantHistory[0].user?.profile?.name }
                : null,
            isMine: attendantHistory.length > 0 ? attendantHistory[0].userUid === authorization.data.userUid : false,
            attendantStatus: attendantHistory.length > 0 ? attendantHistory[0].status : null,
          });
        }
      } catch (error) {
        console.error(`EVOLUTION FIND CHATS ERROR: Falha ao encontrar mensagens para o chat ${chat.remoteJid}.`, error);
        data.push({
          ...chat,
          messages: null,
          unreadMessages: 0,
          isLead: false,
          isClient: false,
          attendant: { uid: null, name: null },
          isMine: false,
          attendantStatus: null,
        });
      }
    }

    console.log("EVOLUTION FIND CHATS SUCCESS: Chats encontrados com sucesso.", response.data);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Chats encontrados com sucesso.",
        data,
        total: chatsFiltered.length,
      }),
    };
  } catch (error) {
    console.error("EVOLUTION FIND CHATS ERROR: Falha ao encontrar chats.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao encontrar chats. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
