import Database from "../../../database";
import { formatOnlyNumbers } from "../../../utils/formatPhone";
import * as admin from "firebase-admin";

function sanitizeTemplateName(name: string): string {
  if (!name) return "";
  let cleaned = name.toLowerCase();
  // Substitui qualquer sequência de caracteres não a-z/0-9 por _
  cleaned = cleaned.replace(/[^a-z0-9]+/g, "_");
  // Remove underscores duplicados e nos extremos
  cleaned = cleaned.replace(/_+/g, "_").replace(/^_|_$/g, "");
  return cleaned || ""; // fallback mínimo
}

async function sendMessage(
  phoneId: string,
  whatsappPhone: string,
  phone: string,
  templateName: string,
  bodyText: string
): Promise<{ ok: boolean; data: any; status: number }> {
  console.log("SENDING MESSAGE TO:", phone, "USING TEMPLATE:", templateName);

  const url = `https://graph.facebook.com/v22.0/${phoneId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: "pt_BR" },
      components: [] as any[],
    },
  };

  const start = Date.now();
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
    },
  });
  const elapsed = Date.now() - start;
  let data: any = null;
  try {
    data = await response.json();
    console.log("WHATSAPP TEMPLATE SEND RESPONSE DATA:", data);
  } catch (_) {
    // ignorar parse error
  }

  const ok = response.ok && data?.messages?.[0]?.id;
  if (!ok) {
    console.error("WHATSAPP TEMPLATE SEND FAILED", {
      status: response.status,
      elapsedMs: elapsed,
      error: data?.error,
      templateName,
      phone,
    });
  } else {
    console.log("WHATSAPP TEMPLATE SEND SUCCESS", {
      status: response.status,
      elapsedMs: elapsed,
      messageId: data.messages[0].id,
      phone: data.contacts?.[0]?.wa_id,
      templateName,
    });

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
          `chats/${whatsappPhone}/conversations/${whatsappPhone}-${data.contacts?.[0]?.wa_id}/messages`
        )
        .doc(data.messages[0].id)
        .set({
          body: bodyText,
          from: whatsappPhone,
          id: data.messages[0].id,
          name: "TEMPLATE",
          timestamp: Math.floor(Date.now() / 1000), // Timestamp em segundos
          type: "text",
        });

      const db = admin.firestore();
      const docRef = db
        .collection(`chats/${whatsappPhone}/conversations`)
        .doc(`${whatsappPhone}-${data.contacts?.[0]?.wa_id}`);

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);

        if (!snap.exists) {
          // Documento NÃO existe → criar com campos “iniciais”
          tx.set(docRef, {
            lastMessage: "Mensagem Modelo",
            name: `${data.contacts?.[0]?.wa_id}`,
            unReadMessages: 1,
            updatedAt: Math.floor(Date.now() / 1000),
            // qualquer outro campo inicial
          });
        } else {
          // Documento EXISTE → atualizar apenas campos relevantes
          tx.update(docRef, {
            lastMessage: "Mensagem Modelo",
            unReadMessages: 1,
            updatedAt: Math.floor(Date.now() / 1000),
          });
        }
      });
    } catch (error) {
      console.error(
        "WHATSAPP-API SEND TEXT ERROR: Erro ao salvar mensagem no Firestore.",
        error
      );
      return {
        status: 500,
        ok: false,
        data: { error: "Erro ao salvar mensagem no Firestore." },
      };
    }
  }
  return { ok, data, status: response.status };
}

export const handler = async () => {
  const database = new Database();
  let messagesCounter = 0;

  console.log(
    "SCHEDULED SEND MESSAGES -  Starting scheduled message sending process..."
  );

  try {
    const messages = await database.client.scheduledMessage.findMany({
      where: {
        sendAt: { lte: new Date() },
        status: "PENDING",
      },
      include: {
        messageTemplate: { select: { name: true } },
        recipients: {
          include: { lead: true, client: { include: { clientProfile: true } } },
        },
      },
    });

    console.log("Found scheduled messages to send:", messages.length);

    for (const message of messages) {
      const configs = await database.client.userConfig.findMany({
        where: {
          AND: [
            { userUid: message.userUid },
            {
              OR: [{ key: "WHATSAPP-PHONE-ID" }, { key: "WHATSAPP" }],
            },
          ],
        },
      });
      const phoneId = configs.find((c) => c.key === "WHATSAPP-PHONE-ID");
      const whatsappPhone = configs.find((c) => c.key === "WHATSAPP");

      if (phoneId) {
        const recipients = message.recipients;
        console.log(
          `Sending message to ${recipients.length} recipients for scheduled message UID: ${message.uid}`
        );

        for (const recipient of recipients) {
          console.log("DATA recipient:", recipient);
          try {
            let phone =
              recipient.lead?.phone ||
              recipient.client?.clientProfile?.phone ||
              recipient?.remoteJid;
            if (phone.includes("@")) {
              phone = phone.split("@")[0];
            }

            const template = sanitizeTemplateName(
              message.messageTemplate?.name || ""
            );

            console.log(
              `Preparing to send message to recipient UID: ${recipient.uid}, Phone: ${phone}, Template: ${template}`
            );

            if (!phone || !template) {
              console.error(
                `No phone number or template found for recipient UID: ${recipient.uid}`
              );
              continue;
            }

            const sendResult = await sendMessage(
              phoneId.value,
              whatsappPhone?.value || "",
              formatOnlyNumbers(phone || ""),
              template || "default_template",
              message.message
            );
            if (sendResult.ok) {
              console.log(`Message sent to ${phone}`);
              messagesCounter++;
            } else {
              console.warn(`Message NOT delivered to ${phone}`, {
                status: sendResult.status,
                error: sendResult.data?.error,
                templateUsed: template,
              });
            }
          } catch (error) {
            console.error(`Failed to send message ID ${message.uid}:`, error);
          }
        }

        // Marca como SENT somente se houve pelo menos 1 envio bem-sucedido
        await database.client.scheduledMessage.update({
          where: { uid: message.uid },
          data: { status: messagesCounter > 0 ? "SENT" : "FAILED" },
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: `Enviado mensagens: ${messagesCounter}`,
      }),
    };
  } catch (error) {
    console.error("SEND MESSAGES.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao enviar mensagens.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
