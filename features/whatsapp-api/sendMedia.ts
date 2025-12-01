import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import axios from "axios";
import { subscription } from "../middlewares/subscription.middleware";
import * as admin from "firebase-admin";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();

  try {
    // Autenticação
    const authorization = (await auth(event)) as {
      success: boolean;
      data: any;
    };

    if (!authorization || !authorization.success) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: token de autorização ausente ou inválido.",
        }),
      };
    }

    // Verificar assinatura
    const subscriptionMiddleware = (await subscription(
      authorization.data.masterUid
    )) as {
      success: boolean;
    };

    if (!subscriptionMiddleware.success) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    // Parse do body
    const { caption, number, fileName, media, mediaType, mimeType } =
      JSON.parse(event.body || "{}");

    console.log("WHATSAPP-API SEND MEDIA: Payload recebido:", {
      caption,
      number,
      media,
      fileName,
      mediaType,
      mimeType,
    });

    // Validação dos parâmetros obrigatórios
    if (!number || !media || !mediaType || !mimeType) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Parâmetros obrigatórios ausentes: number, media, mediaType e mimeType são necessários.",
        }),
      };
    }

    // Validação do tipo de mídia
    const supportedMediaTypes = ["image", "document"];
    if (!supportedMediaTypes.includes(mediaType)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: `Tipo de mídia não suportado: ${mediaType}. Tipos suportados: ${supportedMediaTypes.join(
            ", "
          )}`,
        }),
      };
    }

    // Buscar configurações do WhatsApp
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
        "WHATSAPP-API SEND MEDIA ERROR: Usuário ou config não encontrado."
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Usuário não encontrado.",
        }),
      };
    }

    const whatsappIdConfig = userMaster.configs.find(
      (config) => config.key === "WHATSAPP-PHONE-ID"
    );
    const whatsappConfig = userMaster.configs.find(
      (config) => config.key === "WHATSAPP"
    );

    if (
      !process.env.WHATSAPP_TOKEN ||
      !whatsappIdConfig?.value ||
      !whatsappConfig?.value
    ) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg: "Configuração do WhatsApp não encontrada.",
        }),
      };
    }

    // Format phone number with country code for WhatsApp API
    let formattedNumber = String(number).replace(/\D/g, "");

    // Add Brazil country code (55) if not present and number looks Brazilian
    if (formattedNumber.length === 10 || formattedNumber.length === 11) {
      // Brazilian number without country code
      formattedNumber = "55" + formattedNumber;
    } else if (
      !formattedNumber.startsWith("55") &&
      formattedNumber.length < 13
    ) {
      // Add + prefix if it looks like an international number without country code
      formattedNumber = "55" + formattedNumber;
    }

    console.log("FORMATTED NUMBER:", formattedNumber);

    let user;
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
    }

    console.log("WHATSAPP-API SEND MEDIA: Configurações encontradas:", {
      whatsappPhoneId: whatsappIdConfig?.value,
      whatsappNumber: whatsappConfig?.value,
      formattedNumber,
    });

    let requestBody: any;

    console.log("Processando mídia em base64");

    const mediaBuffer = Buffer.from(media, "base64");

    //preparar dados
    const formData = new FormData();
    // Convert Buffer to Blob before appending to FormData
    const mediaBlob = new Blob([mediaBuffer], { type: mimeType });
    formData.append("file", mediaBlob, fileName);
    formData.append("type", mimeType);
    formData.append("messaging_product", "whatsapp");
    // Upload do áudio para o WhatsApp
    let uploadResponse;
    try {
      uploadResponse = await axios.post(
        `${process.env.WHATSAPP_URL}/${whatsappIdConfig.value}/media`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          },
        }
      );

      console.log("Upload realizado com sucesso:", uploadResponse.data);
    } catch (uploadError: any) {
      console.error("Erro no upload da mídia:", uploadError.response?.data);
      return {
        statusCode: uploadError.response?.status || 500,
        body: JSON.stringify({
          success: false,
          msg: "Falha ao fazer upload da mídia para o WhatsApp",
          error: uploadError.response?.data?.error?.message,
          errorCode: uploadError.response?.data?.error?.code,
        }),
      };
    }

    const mediaId = uploadResponse.data.id;

    // Construir o corpo da requisição baseado no tipo de mídia
    requestBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedNumber,
      type: mediaType,
    };

    // Adicionar o campo específico do tipo de mídia
    switch (mediaType) {
      case "image":
        requestBody.image = { id: mediaId, caption };
        break;
      case "document":
        requestBody.document = { 
          id: mediaId, 
          caption,
          filename: fileName || "documento.pdf" // Incluir o nome do arquivo
        };
        break;
      default:
        console.error("Tipo de mídia não suportado:", mediaType);
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            msg: `Tipo de mídia não suportado: ${mediaType}`,
          }),
        };
    }

    const response = await axios.post(
      `${process.env.WHATSAPP_URL}/${whatsappIdConfig.value}/messages`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
      }
    );
    console.log("WHATSAPP-API SEND MEDIA Response:", response);
    console.log(
      "WHATSAPP-API SEND MEDIA: Mensagem enviada com sucesso:",
      response.data
    );

    // Salvar mensagem no Firebase se o envio foi bem-sucedido
    if (response.status === 200) {
      try {
        // Inicializar o Firebase Admin SDK apenas se ainda não foi inicializado
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
      } catch (firebaseInitError) {
        console.error("FIREBASE INIT ERROR:", firebaseInitError);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            msg: "Erro ao inicializar Firebase.",
          }),
        };
      }

      try {
        // Preparar dados da mensagem
        const getMediaDescription = (type: string) => {
          switch (type?.toLowerCase()) {
            case "image":
              return "Imagem";
            case "video":
              return "Vídeo";
            case "document":
              return "Documento";
            default:
              return "Mídia";
          }
        };

        const messageData: any = {
          body: caption || getMediaDescription(mediaType),
          from: whatsappConfig.value,
          id: response?.data?.messages[0].id,
          name: user?.profile?.name || userMaster?.profile?.name,
          timestamp: Math.floor(Date.now() / 1000), // Timestamp em segundos
          type: mediaType,
        };

        // Adicionar dados específicos baseado no tipo de mídia
        if (mediaType === "image") {
          messageData.image = {
            id: mediaId,
            caption,
          };
        } else if (mediaType === "document") {
          messageData.document = {
            id: mediaId,
            caption,
            filename: fileName || "documento.pdf", // Incluir o nome do arquivo no Firebase também
          };
        }

        await admin
          .firestore()
          .collection(
            `chats/${whatsappConfig.value}/conversations/${whatsappConfig.value}-${formattedNumber}/messages`
          )
          .add(messageData);
      } catch (error) {
        console.error(
          "WHATSAPP-API SEND MEDIA ERROR: Erro ao salvar mensagem no Firestore.",
          error
        );
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            msg: "Erro ao enviar mensagem de mídia.",
          }),
        };
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Mensagem de mídia enviada com sucesso.",
        data: {
          messageId: response.data.messages?.[0]?.id,
          contacts: response.data.contacts,
          whatsappResponse: response.data,
        },
      }),
    };
  } catch (error: any) {
    console.error("WHATSAPP SEND MEDIA ERROR:", error);

    // Log detalhado do erro para debugging
    if (error.response) {
      console.error("Error Response Status:", error.response.status);
      console.error(
        "Error Response Data:",
        JSON.stringify(error.response.data, null, 2)
      );
      console.error("Error Response Headers:", error.response.headers);
    }

    if (error.request) {
      console.error("Error Request:", error.request);
    }

    console.error("Error Config:", error.config);

    // Erro da API do WhatsApp
    if (error.response?.data) {
      const whatsappError = error.response.data.error;
      console.error("WhatsApp API Error Details:", {
        message: whatsappError?.message,
        code: whatsappError?.code,
        type: whatsappError?.type,
        errorData: whatsappError?.error_data,
        fbtrace_id: error.response.data.error?.fbtrace_id,
      });

      return {
        statusCode: error.response.status || 500,
        body: JSON.stringify({
          success: false,
          msg: `Erro da API do WhatsApp: ${
            whatsappError?.message || "Erro desconhecido"
          }`,
          errorCode: whatsappError?.code,
          errorType: whatsappError?.type,
          errorDetails: whatsappError?.error_data,
          fbtrace_id: error.response.data.error?.fbtrace_id,
        }),
      };
    }

    // Erro genérico
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao enviar a mensagem de mídia. Tente novamente mais tarde.",
        error: error.message,
      }),
    };
  } finally {
    await database.disconnect();
  }
};
