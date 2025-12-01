import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import axios from "axios";
import { subscription } from "../middlewares/subscription.middleware";
import * as admin from "firebase-admin";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const subscriptionMiddleware = (await subscription(
    authorization.data.masterUid
  )) as {
    success: boolean;
  };

  const { phone, text } = JSON.parse(event.body || "");

  console.log("WHATSAPP-API SEND TEXT: Body recebido:", phone, text);

  try {
    if (!authorization || !authorization.success) {
      console.error(
        "WHATSAPP-API SEND TEXT ERROR: Cabeçalho de autorização ausente ou inválido.",
        { authorization }
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: token de autorização ausente ou inválido.",
        }),
      };
    }

    if (!subscriptionMiddleware.success) {
      console.error(
        "WHATSAPP-API SEND TEXT ERROR: Assinatura inválida ou expirada.",
        { subscriptionMiddleware }
      );
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    if (!phone || !text) {
      console.error(
        "WHATSAPP-API SEND TEXT ERROR: Campos obrigatórios não informados (telefone, mensagem).",
        { phone, text }
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Requisição inválida: Campos obrigatórios não informados (telefone, mensagem).",
        }),
      };
    }

    // Validar formato do telefone
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(phone.replace(/\D/g, ""))) {
      console.error(
        "WHATSAPP-API SEND TEXT ERROR: Formato de telefone inválido.",
        { phone }
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Formato de telefone inválido.",
        }),
      };
    }

    const userMaster = await database.client.user.findUnique({
      where: {
        uid: authorization.data.masterUid,
      },
      select: {
        profile: {
          select: {
            name: true,
            email: true,
          },
        },
        configs: {
          where: {
            OR: [{ key: "WHATSAPP-PHONE-ID" }, { key: "WHATSAPP" }],
          },
        },
      },
    });

    if (
      !userMaster ||
      !userMaster.profile ||
      !userMaster.profile.email ||
      !userMaster.configs.length
    ) {
      console.error(
        "WHATSAPP-API SEND TEXT ERROR: Usuário ou configuração não encontrado.",
        {
          userMaster: userMaster
            ? {
                hasProfile: !!userMaster.profile,
                hasEmail: !!userMaster.profile?.email,
                configsLength: userMaster.configs?.length || 0,
              }
            : null,
          masterUid: authorization.data.masterUid,
        }
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Configuração do WhatsApp não encontrada. Verifique se o WhatsApp está configurado corretamente.",
        }),
      };
    }

    console.log("USER CONFIGS", userMaster.configs);

    // Validar se as configurações do WhatsApp estão corretas
    const whatsappConfig = userMaster.configs.find(
      (config) => config.key === "WHATSAPP-PHONE-ID"
    );
    const whatsappPhone = userMaster.configs.find(
      (config) => config.key === "WHATSAPP"
    );

    console.log("WHATSAPP CONFIG", whatsappConfig);
    console.log("WHATSAPP PHONE", whatsappPhone);

    if (!whatsappConfig || !whatsappConfig.value) {
      console.error(
        "WHATSAPP-API SEND TEXT ERROR: Configuração do WhatsApp inválida.",
        {
          configs: userMaster.configs.map((c) => ({
            key: c.key,
            hasValue: !!c.value,
          })),
        }
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Configuração do WhatsApp inválida. Verifique as configurações do WhatsApp.",
        }),
      };
    }

    // Validar variáveis de ambiente necessárias
    if (!process.env.WHATSAPP_URL || !process.env.WHATSAPP_TOKEN) {
      console.error(
        "WHATSAPP-API SEND TEXT ERROR: Variáveis de ambiente do WhatsApp não configuradas.",
        {
          hasWhatsappUrl: !!process.env.WHATSAPP_URL,
          hasWhatsappToken: !!process.env.WHATSAPP_TOKEN,
        }
      );
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg: "Erro de configuração do servidor. Tente novamente mais tarde.",
        }),
      };
    }

    let user;
    let finalText = text;
    if (authorization.data.masterUid !== authorization.data.userUid) {
      user = await database.client.user.findUnique({
        where: {
          uid: authorization.data.userUid,
        },
        select: {
          profile: {
            select: {
              name: true,
            },
          },
        },
      });
      if (user && user.profile && user.profile.name) {
        finalText = `*${user.profile.name}*\n\n${text}`;
      }
    } else {
      finalText = `*${userMaster.profile.name}*\n\n${text}`;
    }

    const response = await axios.post(
      `${process.env.WHATSAPP_URL}/${whatsappConfig.value}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: `${phone}`,
        type: "text",
        text: {
          preview_url: false,
          body: finalText,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      "WHATSAPP-API SEND TEXT SUCCESS: Mensagem de texto enviada com sucesso.",
      {
        messageId: response.data?.messages?.[0]?.id,
        status: response.status,
        phone: phone,
        textLength: finalText.length,
      }
    );

    console.log("RESPONSE WHATSAPP STATUS", response.status);

    if (response.status === 200) {
      console.log("GET ENV AWS FIREBASE KEY");
      //KEY FIREBASE
      // const secretsManager = new SecretsManager();
      // const secret = await secretsManager
      //   .getSecretValue({ SecretId: "firebase-key" })
      //   .promise();

      // console.log("FIREBASE CONFIG", secret);
      // Inicializar o Firebase Admin SDK
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey:
              "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDKEG5SRQ8l/urE\nkqxbPUoDsE5rcU26ChYON08XLtoe9essYRC483fho25wWnvXIzWXzs3gAFUH95xW\nPFL7DVQ56CzZRBoEaWLSx/Gy5tGR99fvwVfaS2GfFrqFPxkekvQh16hSfwLasUB6\nUWgQjEb+YQGIuIWaTn20ktL+NdHjjsVJSun6rtL/UAYVUwtpgh/ia2W0R6pWgC8T\nzLy7TRMpfDakdZyqwi+3/Of4Q2s4zb54/6WUJpxc0KUGMjumMpi1yD30Rk2iqLQO\nkL0fMGF1eof4ct5LsuHR+BI5ifwE7yFFWQo/LxljdBMO0vrsxdfOMWKGBwbPQ6oX\n6eIykLixAgMBAAECggEAHSpk+hv8tUPHuCrhlOPSUJj8oLaAfRdimpeyI0sAcdKW\nKNgz1TZTOe7gjHgLAwEShcB0Z940Z8t+NdZMNe91FkykWJHjXXqmqHzyrptxaWvI\nL9OM7jXON+vMbVovsoGMmmvp4Epz64QFJgKlDippPuNamNTld+HXdB5zNP0ot/sM\nZ3UIFZAwEpMtffxqid5ofOwUwFyy3HFyPWg63vSZdeSAS2lMnZd4BfkCKeMkAph9\n3bXegF8FBs2NspsXAXa0tYNxnPCrqqoRsnQlWs4+c5i3ewKwHbJvyKLBgSxck2JY\ntuOAPsg068dl9u5IWmeBiZVEqk7EdtUpsvrxelivlwKBgQDkhf6OqxBVf4nMq3U5\nmmpA4qgaezRnpQmOlFo7WjEJ9CGnLtBhCf9d7DQIAKLZ+XJNMmabbgKyKaoOshfQ\nSPmjToZigX2KgNXGgi9jKqG3RCoRJshSOS7TJ1YuybYaiNGDnzxD5nPhRjoy21s0\nj7sJ+EFYdLXh1S3yPnnTxkO60wKBgQDiXAPavzR34GGrvFRCTRJeIYIbyJOnVfFB\nvdrTIX/VBKRQmF1JMHm01ynnlplboTrD6AjDLxj1CxGSryzRrGOJgwT9XHMleBR9\nvO9hwCy3wWDVwzJUvuP7UJEGSDKpS8G1RK5CrcAO1JFIJ1ZKYkvS6FUA8gjFdMwi\nOqghqCVD6wKBgQDkOh5dBeMuQE2zJpnQibMMUlFpARr5WA4PY4IqPI01T6g8e7iI\n8Z8kgj4Er/30i/fnuSpYmKoAnTPFsX+u+PK4cjgsMP7cUIcv1dzVwUH48g7BSmZO\nF+X35BVibPl9zp7QQTvC5Gle1vBQ0lpoSBOYhWNdoFH11R4qDNNG+X+zGQKBgQCJ\niBTDdMchStCtMpkTS5asYLmXve+QjVQveHYbL9BmkhJv8ZNEY9KewNhyIHt/Q9/b\npgCk7tnAEQCVWh/mKVK0+0kt010W1/XDS+c6QjQpVbJLTvUmrnEAgjwLUBSP7jp8\ns4UZeE4n9Jls+JGiUkT1mToEgAo6RrO83FzJTkuODwKBgEmgkrS/SVapMWTOJYOp\n4D6yhLbG9kPkrO92wWhsHMT6ieO2YDIcw07VE9/z5T8qQD199BTGM3m+W9N6zCda\n1b2jgAyHA+Nkvkp0SbGXdn0hQI5agGKl2Us3yM4aZt5g+9ft04gQAqFksEW3Nt8/\nnzqcAMYoKQV3cfM55V1lXZYy\n-----END PRIVATE KEY-----\n",
          }),
        });
      }

      try {
        await admin
          .firestore()
          .collection(
            `chats/${whatsappPhone?.value}/conversations/${whatsappPhone?.value}-${phone}/messages`
          )
          .doc(response?.data?.messages[0].id)
          .set({
            body: finalText,
            from: whatsappPhone?.value,
            id: response?.data?.messages[0].id,
            name: user?.profile?.name || userMaster?.profile?.name,
            timestamp: Math.floor(Date.now() / 1000), // Timestamp em segundos
            type: "text",
          });
      } catch (error) {
        console.error(
          "WHATSAPP-API SEND TEXT ERROR: Erro ao salvar mensagem no Firestore.",
          error
        );
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            msg: "Erro ao enviar mensagem.",
          }),
        };
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Mensagem de texto enviada com sucesso.",
      }),
    };
  } catch (error) {
    console.error(
      "WHATSAPP-API SEND TEXT ERROR: Falha ao enviar a mensagem de texto.",
      {
        error: error.message,
        stack: error.stack,
        phone: phone,
        textLength: text?.length || 0,
        isAxiosError: error.isAxiosError,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
        requestUrl: error.config?.url,
        requestMethod: error.config?.method,
      }
    );

    // Tratamento específico para diferentes tipos de erro
    if (error.isAxiosError) {
      const status = error.response?.status;
      const errorData = error.response?.data;

      if (status === 401) {
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            msg: "Erro de autenticação com WhatsApp. Verifique as configurações.",
          }),
        };
      }

      if (status === 400) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            msg: `Erro na requisição: ${
              errorData?.error?.message || "Dados inválidos"
            }`,
          }),
        };
      }

      if (status === 429) {
        return {
          statusCode: 429,
          body: JSON.stringify({
            success: false,
            msg: "Muitas requisições. Tente novamente em alguns minutos.",
          }),
        };
      }

      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        return {
          statusCode: 408,
          body: JSON.stringify({
            success: false,
            msg: "Timeout na conexão com WhatsApp. Tente novamente.",
          }),
        };
      }
    }

    // Erro genérico
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao enviar a mensagem de texto. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
