import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";
import { getUnixTime } from "date-fns";
import * as AWS from "aws-sdk";
import * as admin from "firebase-admin";
import { doPost } from "../../sources/alldo-n8n/api";

const lambda = new AWS.Lambda();

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

const clearCacheLeadClient = async (remoteJid: string) => {
  try {
    console.log("CLEAR CACHE LEAD CLIENT: ", remoteJid);
    const phone = remoteJid.split("-")[1];
    const response = await doPost("/webhook/clear-cache-lead-client", {
      wa_id: phone,
    });

    console.log("CLEAR CACHE LEAD CLIENT RESPONSE: ", response);
    return response;
  } catch (error) {
    console.error("CLEAR CACHE LEAD CLIENT ERROR: ", error);
    return false;
  }
};

// Função para chamar a rota clients/get
const getClients = async (queryParams: any, authToken: string) => {
  try {
    const responseGetClients = await lambda
      .invoke({
        FunctionName: `alldo-assistente-api-${process.env.NODE_ENV}-clients-get`,
        InvocationType: "RequestResponse",
        LogType: "Tail",
        Payload: JSON.stringify({
          httpMethod: "GET",
          headers: {
            authorization: authToken,
          },
          queryStringParameters: queryParams,
        }),
      })
      .promise();

    if (responseGetClients.Payload) {
      const result = JSON.parse(responseGetClients.Payload.toString());
      return JSON.parse(result.body);
    }

    return null;
  } catch (error) {
    console.error("Erro ao chamar função clients/get:", error);
    return null;
  }
};

// Função para chamar a rota leads/get
const getLeads = async (queryParams: any, authToken: string) => {
  try {
    const responseGetLeads = await lambda
      .invoke({
        FunctionName: `alldo-assistente-api-${process.env.NODE_ENV}-leads-get`,
        InvocationType: "RequestResponse",
        LogType: "Tail",
        Payload: JSON.stringify({
          httpMethod: "GET",
          headers: {
            authorization: authToken,
          },
          queryStringParameters: queryParams,
        }),
      })
      .promise();

    if (responseGetLeads.Payload) {
      const result = JSON.parse(responseGetLeads.Payload.toString());
      return JSON.parse(result.body);
    }

    return null;
  } catch (error) {
    console.error("Erro ao chamar função leads/get:", error);
    return null;
  }
};

// Função para chamar a rota clients/changeOwner
const changeClientOwner = async (
  uid: string,
  ownerUid: string,
  authToken: string,
  remoteJid: string
) => {
  try {
    const responseChangeOwner = await lambda
      .invoke({
        FunctionName: `alldo-assistente-api-${process.env.NODE_ENV}-clients-change-owner`,
        InvocationType: "RequestResponse",
        LogType: "Tail",
        Payload: JSON.stringify({
          httpMethod: "PUT",
          headers: {
            authorization: authToken,
          },
          pathParameters: { uid },
          body: JSON.stringify({ ownerUid }),
        }),
      })
      .promise();

    if (responseChangeOwner.Payload) {
      const result = JSON.parse(responseChangeOwner.Payload.toString());
      console.log(
        "CHANGE OWNER FIREBASE",
        `chats/${remoteJid.split("-")[0]}/conversations/${remoteJid}`,
        ownerUid
      );
      try {
        await admin
          .firestore()
          .collection(`chats/${remoteJid.split("-")[0]}/conversations`)
          .doc(remoteJid)
          .set(
            {
              owner: ownerUid,
            },
            { merge: true }
          );
      } catch (error) {
        console.error(
          "CHANGE OWNER FIREBASE ERROR: Erro ao atualizar no Firestore.",
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

      return JSON.parse(result.body);
    }

    return null;
  } catch (error) {
    console.error("Erro ao chamar função clients/changeOwner:", error);
    return null;
  }
};

// Função para chamar a rota leads/changeOwner
const changeLeadOwner = async (
  uid: string,
  ownerUid: string,
  authToken: string,
  remoteJid: string
) => {
  try {
    const responseChangeOwner = await lambda
      .invoke({
        FunctionName: `alldo-assistente-api-${process.env.NODE_ENV}-leads-change-owner`,
        InvocationType: "RequestResponse",
        LogType: "Tail",
        Payload: JSON.stringify({
          httpMethod: "PUT",
          headers: {
            authorization: authToken,
          },
          pathParameters: { uid },
          body: JSON.stringify({ ownerUid }),
        }),
      })
      .promise();

    if (responseChangeOwner.Payload) {
      const result = JSON.parse(responseChangeOwner.Payload.toString());
      console.log(
        "CHANGE OWNER FIREBASE",
        `chats/${remoteJid.split("-")[0]}/conversations/${remoteJid}`,
        ownerUid
      );
      try {
        await admin
          .firestore()
          .collection(`chats/${remoteJid.split("-")[0]}/conversations`)
          .doc(remoteJid)
          .set(
            {
              owner: ownerUid,
            },
            { merge: true }
          );
      } catch (error) {
        console.error(
          "CHANGE OWNER FIREBASE ERROR: Erro ao atualizar no Firestore.",
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

      return JSON.parse(result.body);
    }

    return null;
  } catch (error) {
    console.error("Erro ao chamar função leads/changeOwner:", error);
    return null;
  }
};

const updateClientIaConversation = async (
  uid: string,
  iaConversation: boolean,
  database: Database
) => {
  console.log("UPDATE CLIENT IA CONVERSATION:", uid, iaConversation);
  try {
    await database.client.client.update({
      where: { uid },
      data: { iaConversation },
    });
    console.log(
      `Cliente ${uid} atualizado: iaConversation = ${iaConversation}`
    );
  } catch (error) {
    console.error(`Erro ao atualizar iaConversation do cliente ${uid}:`, error);
  }
};

const updateLeadIaConversation = async (
  uid: string,
  iaConversation: boolean,
  database: Database
) => {
  try {
    await database.client.lead.update({
      where: { uid },
      data: { iaConversation },
    });
    console.log(`Lead ${uid} atualizado: iaConversation = ${iaConversation}`);
  } catch (error) {
    console.error(`Erro ao atualizar iaConversation do lead ${uid}:`, error);
  }
};

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const subscriptionMiddleware = (await subscription(
    authorization.data.masterUid
  )) as {
    success: boolean;
  };
  const { remoteJid, phone } = JSON.parse(event.body || "");
  const { status, userUid } = event.queryStringParameters || {};
  const targetOwnerUid = userUid ? userUid : authorization.data.userUid;

  console.log(event.queryStringParameters, "AQUI AS QUERYS");
  console.log(JSON.parse(event.body || ""), "AQUI O BODY");

  // Remove o prefixo "55" do início do número de telefone, se existir
  const phoneWithoutPrefix =
    phone && phone.startsWith("55") ? phone.substring(2) : phone;

  try {
    if (!authorization) {
      console.error(
        "ATTENDANT HISTORY TRANSFER ERROR: Não autorizado: token de autenticação ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: token de autenticação ausente ou inválido.",
        }),
      };
    }
    if (!subscriptionMiddleware.success) {
      console.error(
        "ATTENDANT HISTORY TRANSFER ERROR: Assinatura inválida ou expirada."
      );
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    console.log(event.headers.authorization, "headers");

    // Busca dados dos clientes
    const clientsData = await getClients(
      { search: phoneWithoutPrefix },
      event.headers.authorization || ""
    );
    console.log("Dados dos clientes:", clientsData);

    let contactType = null;
    let contactUid = null;

    // Verifica se encontrou clientes
    if (clientsData && clientsData.data && clientsData.data.length > 0) {
      contactType = "client";
      contactUid = clientsData.data[0].uid;
      console.log("Cliente encontrado com UID:", contactUid);
    } else {
      // Se não encontrou clientes, busca leads
      const leadsData = await getLeads(
        { search: phoneWithoutPrefix },
        event.headers.authorization || ""
      );
      console.log("Dados dos leads:", leadsData);

      if (leadsData && leadsData.data && leadsData.data.length > 0) {
        contactType = "lead";
        contactUid = leadsData.data[0].uid;
        console.log("Lead encontrado com UID:", contactUid);
      }
    }

    // Se encontrou um contato, chama a função de mudança de proprietário
    if (contactUid && contactType) {
      try {
        let changeOwnerResult = null;

        if (contactType === "client") {
          changeOwnerResult = await changeClientOwner(
            contactUid,
            targetOwnerUid,
            event.headers.authorization || "",
            remoteJid
          );
          console.log(
            "Resultado da mudança de proprietário do cliente:",
            changeOwnerResult
          );
        } else if (contactType === "lead") {
          changeOwnerResult = await changeLeadOwner(
            contactUid,
            targetOwnerUid,
            event.headers.authorization || "",
            remoteJid
          );
          console.log(
            "Resultado da mudança de proprietário do lead:",
            changeOwnerResult
          );
        }

        if (changeOwnerResult && changeOwnerResult.success) {
          console.log(
            `Proprietário do ${contactType} alterado com sucesso para o usuário atual`
          );
        } else {
          console.warn(
            `Falha ao alterar proprietário do ${contactType}:`,
            changeOwnerResult
          );
        }
      } catch (error) {
        console.error("Erro ao alterar proprietário:", error);
      }
    } else {
      console.log(
        "Nenhum cliente ou lead encontrado para o telefone:",
        phoneWithoutPrefix
      );
    }

    if (!remoteJid) {
      console.error(
        "ATTENDANT HISTORY TRANSFER ERROR: Campo obrigatório não informado (whatsapp)."
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Campo obrigatório não informado (WhatsApp).",
        }),
      };
    }

    clearCacheLeadClient(remoteJid);

    // CASO: Status FINALIZED
    if (status === "FINALIZED") {
      await database.client.attendantHistory.create({
        data: {
          remoteJid,
          timestamp: getUnixTime(new Date()),
          status: "FINALIZED",
          description: "Atendimento finalizado",
          user: {
            connect: {
              uid: authorization.data.userUid,
            },
          },
          master: {
            connect: {
              uid: authorization.data.masterUid,
            },
          },
        },
      });

      console.log(contactUid, "contactUid");
      console.log(contactType, "contactType");

      // FINALIZED: iaConversation = true
      console.log("ANTES DO IF CONTACTUID && CONTACTTYPE");
      if (contactUid && contactType) {
        if (contactType === "client") {
          console.log("CHAMANDO UPDATE CLIENT IA CONVERSATION");
          await updateClientIaConversation(contactUid, true, database);
        } else if (contactType === "lead") {
          console.log("CHAMANDO UPDATE LEAD IA CONVERSATION");
          await updateLeadIaConversation(contactUid, true, database);
        }
      }

      console.log(
        "CHANGE STATUS FIREBASE",
        `chats/${remoteJid.split("-")[0]}/conversations/${remoteJid}`,
        status
      );
      try {
        await admin
          .firestore()
          .collection(`chats/${remoteJid.split("-")[0]}/conversations`)
          .doc(remoteJid)
          .set(
            {
              status: status,
            },
            { merge: true }
          );
      } catch (error) {
        console.error(
          "CHANGE STATUS FIREBASE ERROR: Erro ao atualizar no Firestore.",
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

      console.log(
        "ATTENDANT HISTORY TRANSFER SUCCESS: Atendimento finalizado com sucesso."
      );
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          msg: "Atendimento finalizado com sucesso.",
        }),
      };
    }

    // CASO: Status CONVERTED
    if (status === "CONVERTED") {
      await database.client.attendantHistory.create({
        data: {
          remoteJid,
          timestamp: getUnixTime(new Date()),
          status: "CONVERTED",
          description: "Lead convertido para Cliente",
          user: {
            connect: {
              uid: authorization.data.userUid,
            },
          },
          master: {
            connect: {
              uid: authorization.data.masterUid,
            },
          },
        },
      });

      console.log(
        "ATTENDANT HISTORY TRANSFER SUCCESS: Cliente convertido com sucesso."
      );
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          msg: "Lead convertido para Cliente com sucesso.",
        }),
      };
    }

    // CASO: Transferência de atendente (IN_PROGRESS)
    const attendant = await database.client.attendantHistory.findFirst({
      where: {
        remoteJid,
        masterUid: authorization.data.masterUid,
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    if (attendant) {
      if (attendant.status !== "FINALIZED") {
        await database.client.attendantHistory.update({
          where: { uid: attendant.uid },
          data: {
            transferTo: userUid,
            status: "TRANSFERRED",
            updatedAt: new Date(),
          },
        });
      }
      // Cria novo registro para o novo atendente
      await database.client.attendantHistory.create({
        data: {
          remoteJid,
          timestamp: getUnixTime(new Date()),
          status: "IN_PROGRESS",
          description: "Transferência de atendente",
          updatedAt: new Date(),
          user: {
            connect: {
              uid: userUid ? userUid : authorization.data.userUid,
            },
          },
          master: {
            connect: {
              uid: authorization.data.masterUid,
            },
          },
        },
      });

      console.log("ANTES DO IF CONTACTUID && CONTACTTYPE");
      if (contactUid && contactType) {
        if (contactType === "client") {
          console.log("CHAMANDO UPDATE CLIENT IA CONVERSATION");
          await updateClientIaConversation(contactUid, false, database);
        } else if (contactType === "lead") {
          console.log("CHAMANDO UPDATE LEAD IA CONVERSATION");
          await updateLeadIaConversation(contactUid, false, database);
        }
      }
    } else {
      // Primeiro atendimento
      await database.client.attendantHistory.create({
        data: {
          remoteJid,
          timestamp: getUnixTime(new Date()),
          status: "IN_PROGRESS",
          description: "Transferência de atendente",
          updatedAt: new Date(),
          user: {
            connect: {
              uid: userUid ? userUid : authorization.data.userUid,
            },
          },
          master: {
            connect: {
              uid: authorization.data.masterUid,
            },
          },
        },
      });

      // IN_PROGRESS: iaConversation = false
      if (contactUid && contactType) {
        if (contactType === "client") {
          await updateClientIaConversation(contactUid, false, database);
        } else if (contactType === "lead") {
          await updateLeadIaConversation(contactUid, false, database);
        }
      }
    }

    console.log(
      "CHANGE STATUS FIREBASE",
      `chats/${remoteJid.split("-")[0]}/conversations/${remoteJid}`,
      "IN_PROGRESS"
    );
    try {
      await admin
        .firestore()
        .collection(`chats/${remoteJid.split("-")[0]}/conversations`)
        .doc(remoteJid)
        .set(
          {
            status: "IN_PROGRESS",
          },
          { merge: true }
        );
    } catch (error) {
      console.error(
        "CHANGE STATUS FIREBASE ERROR: Erro ao atualizar no Firestore.",
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

    console.log(
      "ATTENDANT HISTORY TRANSFER SUCCESS: Transferencia de atendente efetuada com sucesso."
    );
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Transferencia de atendente efetuada com sucesso.",
      }),
    };
  } catch (error) {
    console.error(
      "ATTENDANT HISTORY TRANSFER ERROR: Falha ao transferir atendente.",
      error
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao transferir atendente. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
