import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import axios from "axios";
import crypto from "crypto";
import { subscription } from "../middlewares/subscription.middleware";
import FormData from "form-data";
import * as admin from "firebase-admin";

import { Lambda } from "aws-sdk";

const lambda = new Lambda();

// Formatos de áudio permitidos pelo WhatsApp
const ALLOWED_AUDIO_TYPES = [
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/amr",
  "audio/ogg",
];

// Limite de tamanho: 16MB (WhatsApp)
const MAX_AUDIO_SIZE = 16 * 1024 * 1024;

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
    const { number, audio } = JSON.parse(event.body || "{}");

    console.log("WHATSAPP-API SEND AUDIO: Payload recebido:", {
      number,
      audioType: typeof audio,
      audioLength: typeof audio === "string" ? audio.length : "N/A",
      audio: audio,
    });

    // Validação de campos obrigatórios
    if (!number || !audio) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Campos obrigatórios não informados (number, audio).",
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
        "WHATSAPP-API SEND AUDIO ERROR: Usuário ou config não encontrado."
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

    const formattedNumber = String(number).replace(/\D/g, "");

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

    console.log("WHATSAPP-API SEND AUDIO: Configurações encontradas:", {
      whatsappPhoneId: whatsappIdConfig?.value,
      whatsappNumber: whatsappConfig?.value,
      formattedNumber,
    });

    let requestBody: any;

    console.log("Processando áudio em base64");

    const matches = audio.match(/^data:([^;,]+)(?:;[^;,]+)*;base64,(.+)$/);
    if (!matches) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Formato base64 inválido. Use: data:audio/ogg;base64,<data>",
        }),
      };
    }

    const mimeType = matches[1];

    console.log(` ORIGINAL Mime-type detectado: ${mimeType}`);

    const isAllowedType = ALLOWED_AUDIO_TYPES.includes(mimeType);

    if (!isAllowedType) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: `Formato de áudio não suportado: ${mimeType}. Formatos aceitos: ${ALLOWED_AUDIO_TYPES.join(
            ", "
          )}, audio/webm`,
        }),
      };
    }

    // CONVERT TO AAC (forçando .m4a)
    const responseConvert = await lambda
      .invoke({
        FunctionName: `convertAudioToOgg`,
        InvocationType: "RequestResponse",
        LogType: "Tail",
        Payload: JSON.stringify({
          base64Audio: audio,
          format: "aac",
        }),
      })
      .promise();

    console.log("RESPONSE CONVERT AAC statusCode:", responseConvert.StatusCode);

    const payloadConvert = responseConvert.Payload
      ? JSON.parse(responseConvert.Payload.toString())
      : {};

    const aacBase64: string = payloadConvert.body;
    if (!aacBase64) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg: "Conversão para AAC não retornou base64.",
          rawPayloadKeys: Object.keys(payloadConvert || {}),
        }),
      };
    }

    // Sanitiza e decodifica
    const cleanBase64 = aacBase64.split(",").pop()?.trim() || "";
    let buffer: Buffer;
    try {
      buffer = Buffer.from(cleanBase64, "base64");
    } catch (e) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg: "Falha ao decodificar áudio AAC convertido.",
        }),
      };
    }
    // Validação leve de container MP4 (ftyp)
    const headStr = buffer.slice(0, 64).toString("latin1");
    if (!headStr.includes("ftyp")) {
      console.warn("AAC_CONTAINER_WARN: Header não contém ftyp esperado", {
        headHex: buffer.subarray(0, 16).toString("hex"),
      });
    }

    // Validar tamanho
    if (buffer.length > MAX_AUDIO_SIZE) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: `Áudio muito grande. Tamanho: ${(
            buffer.length /
            1024 /
            1024
          ).toFixed(2)}MB. Máximo permitido: 16MB`,
        }),
      };
    }

    console.log(
      `Áudio válido: ${mimeType}, tamanho: ${(
        buffer.length /
        1024 /
        1024
      ).toFixed(2)}MB`
    );

    // Hash para correlação
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const headHex = buffer.subarray(0, 16).toString("hex");
    console.log("AUDIO_DEBUG", { sha256, headHex, bytes: buffer.length });

    // Preparar FormData para upload (AAC .m4a)
    const formData = new FormData();
    formData.append("file", buffer, {
      filename: "audio.m4a",
      contentType: "audio/mp4",
    });
    formData.append("type", "audio/mp4");
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
      const wErr = uploadError.response?.data?.error;
      console.error("Erro no upload do áudio:", wErr);
      if (wErr?.code === 131053) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            code: 131053,
            msg: "Media upload error 131053 ao enviar AAC (.m4a).",
            details: wErr?.error_data?.details,
            sugestao:
              "Verifique container MP4 válido (ftyp), mono 16kHz, bitrate moderado (32-64k). Podemos tentar fallback MP3.",
          }),
        };
      }
      return {
        statusCode: uploadError.response?.status || 500,
        body: JSON.stringify({
          success: false,
          msg: "Falha ao fazer upload do áudio AAC para o WhatsApp",
          error: wErr?.message,
          errorCode: wErr?.code,
        }),
      };
    }

    const mediaId = uploadResponse.data.id;
    console.log("MEDIA_UPLOADED", { mediaId, sha256 });

    // espera curta para engine interna processar
    await new Promise((r) => setTimeout(r, 500));

    // Poll simples do media (endpoint metadata é GET /{MEDIA_ID})
    async function pollMedia(id: string) {
      if (!process.env.WHATSAPP_URL) return undefined;
      let last: any;
      for (let i = 0; i < 3; i++) {
        try {
          const meta = await axios.get(`${process.env.WHATSAPP_URL}/${id}`, {
            headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
          });
          last = meta.data;
          console.log("MEDIA_POLL", {
            attempt: i + 1,
            id,
            size: last.file_size,
            mime: last.mime_type,
          });
          if (last?.mime_type) break;
        } catch (e: any) {
          console.log("MEDIA_POLL_ERR", {
            attempt: i + 1,
            id,
            status: e.response?.status,
          });
        }
        await new Promise((r) => setTimeout(r, 400 + 200 * i));
      }
      return last;
    }
    let mediaMeta: any = await pollMedia(mediaId);
    if (mediaMeta && !String(mediaMeta.mime_type || "").startsWith("audio/")) {
      console.warn("MEDIA_META_NOT_AUDIO_PRE_SEND", {
        mime: mediaMeta.mime_type,
        mediaId,
      });
      // Tentativa de re-gerar em AAC antes do envio (pré-fallback)
      const preAac = await lambda
        .invoke({
          FunctionName: "convertAudioToOgg",
          InvocationType: "RequestResponse",
          Payload: JSON.stringify({ base64Audio: audio, format: "aac" }),
        })
        .promise();
      const preAacPayload = preAac.Payload
        ? JSON.parse(preAac.Payload.toString())
        : {};
      const preAacBase64: string = preAacPayload.body;
      if (preAacBase64) {
        const preAacBuf = Buffer.from(
          preAacBase64.split(",").pop()?.trim() || "",
          "base64"
        );
        const preForm = new FormData();
        preForm.append("file", preAacBuf, {
          filename: "audio.m4a",
          contentType: "audio/mp4",
        });
        preForm.append("type", "audio/mp4");
        preForm.append("messaging_product", "whatsapp");
        try {
          const preUp = await axios.post(
            `${process.env.WHATSAPP_URL}/${whatsappIdConfig.value}/media`,
            preForm,
            {
              headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
              },
            }
          );
          console.log("MEDIA_PRE_REUPLOAD_AAC", {
            oldMediaId: mediaId,
            newMediaId: preUp.data.id,
          });
          (uploadResponse as any).data.id = preUp.data.id;
          await new Promise((r) => setTimeout(r, 600));
          mediaMeta = await pollMedia(preUp.data.id);
          if (!String(mediaMeta?.mime_type || "").startsWith("audio/")) {
            console.warn("MEDIA_PRE_REUPLOAD_AAC_STILL_NOT_AUDIO", {
              mime: mediaMeta?.mime_type,
            });
            // Tenta MP3
            const preMp3 = await lambda
              .invoke({
                FunctionName: "convertAudioToOgg",
                InvocationType: "RequestResponse",
                Payload: JSON.stringify({ base64Audio: audio, format: "mp3" }),
              })
              .promise();
            const preMp3Payload = preMp3.Payload
              ? JSON.parse(preMp3.Payload.toString())
              : {};
            const preMp3Base64: string = preMp3Payload.body;
            if (preMp3Base64) {
              const preMp3Buf = Buffer.from(
                preMp3Base64.split(",").pop()?.trim() || "",
                "base64"
              );
              const mp3Form = new FormData();
              mp3Form.append("file", preMp3Buf, {
                filename: "audio.mp3",
                contentType: "audio/mpeg",
              });
              mp3Form.append("messaging_product", "whatsapp");
              try {
                const up3 = await axios.post(
                  `${process.env.WHATSAPP_URL}/${whatsappIdConfig.value}/media`,
                  mp3Form,
                  {
                    headers: {
                      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    },
                  }
                );
                console.log("MEDIA_PRE_REUPLOAD_MP3", {
                  newMediaId: up3.data.id,
                });
                (uploadResponse as any).data.id = up3.data.id;
                await new Promise((r) => setTimeout(r, 700));
                mediaMeta = await pollMedia(up3.data.id);
              } catch (mp3Err) {
                console.warn("MEDIA_PRE_REUPLOAD_MP3_ERR", mp3Err);
              }
            }
          }
        } catch (preUpErr) {
          console.warn("MEDIA_PRE_REUPLOAD_AAC_ERR", preUpErr);
        }
      }
    }

    async function sendMessage(voice: boolean) {
      const body = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedNumber,
        type: "audio",
        audio: { id: mediaId, ...(voice ? { voice: true } : {}) },
      };
      if (!whatsappIdConfig?.value) {
        throw new Error("WhatsApp phone id ausente em envio de áudio");
      }
      return axios.post(
        `${process.env.WHATSAPP_URL}/${whatsappIdConfig.value}/messages`,
        body,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          },
        }
      );
    }

    let attempts = 0;
    const maxAttempts = 3;
    let voiceFlag = true;
    let response: any;
    let lastErr: any;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        console.log(`SEND_ATTEMPT ${attempts} voice=${voiceFlag}`);
        response = await sendMessage(voiceFlag);
        break;
      } catch (err: any) {
        lastErr = err;
        const wErr = err.response?.data?.error;
        if (wErr?.code === 131053) {
          console.warn("Erro 131053 no envio", { attempt: attempts, mediaId });
          // no segundo attempt remove voice flag
          if (attempts === 1) {
            voiceFlag = false;
          }
          // backoff
          await new Promise((r) => setTimeout(r, 500 * attempts));
          continue;
        }
        throw err;
      }
    }

    if (!response) {
      const wErr = lastErr?.response?.data?.error;
      if (wErr?.code === 131053) {
        console.warn("Iniciando fallback AAC após falha OGG", { mediaId });
        // Fallback: converter novamente em AAC
        const aacConvert = await lambda
          .invoke({
            FunctionName: `convertAudioToOgg`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify({ base64Audio: audio, format: "aac" }),
          })
          .promise();
        const aacPayload = aacConvert.Payload
          ? JSON.parse(aacConvert.Payload.toString())
          : {};
        const aacBase64: string = aacPayload.body || aacPayload.audioBase64;
        if (!aacBase64) {
          return {
            statusCode: 500,
            body: JSON.stringify({
              success: false,
              msg: "Fallback AAC falhou: sem base64 retornado.",
            }),
          };
        }
        const aacBuf = Buffer.from(
          aacBase64.split(",").pop()?.trim() || "",
          "base64"
        );
        const aacSha = crypto.createHash("sha256").update(aacBuf).digest("hex");
        console.log("AAC_FALLBACK_DEBUG", { bytes: aacBuf.length, aacSha });
        // Upload AAC
        const aacForm = new FormData();
        aacForm.append("file", aacBuf, {
          filename: "audio.m4a",
          contentType: "audio/mp4",
        });
        aacForm.append("type", "audio/mp4");
        aacForm.append("messaging_product", "whatsapp");
        let aacUpload;
        try {
          aacUpload = await axios.post(
            `${process.env.WHATSAPP_URL}/${whatsappIdConfig?.value}/media`,
            aacForm,
            {
              headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
              },
            }
          );
        } catch (upErr: any) {
          return {
            statusCode: upErr.response?.status || 500,
            body: JSON.stringify({
              success: false,
              msg: "Falha upload fallback AAC",
              error: upErr.response?.data?.error?.message,
            }),
          };
        }
        const aacMediaId = aacUpload.data.id;
        await new Promise((r) => setTimeout(r, 600));
        await pollMedia(aacMediaId);
        try {
          const sendAac = await axios.post(
            `${process.env.WHATSAPP_URL}/${whatsappIdConfig?.value}/messages`,
            {
              messaging_product: "whatsapp",
              to: formattedNumber,
              type: "audio",
              audio: { id: aacMediaId },
            },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
              },
            }
          );
          response = sendAac;
          requestBody = {
            messaging_product: "whatsapp",
            to: formattedNumber,
            type: "audio",
            audio: { id: aacMediaId },
          };
          console.log("FALLBACK AAC SUCESSO", { aacMediaId });
        } catch (sendAacErr: any) {
          const aacErrCode = sendAacErr.response?.data?.error?.code;
          console.warn("FALLBACK AAC falhou, tentando MP3", { aacErrCode });
          // Fallback MP3 (terceiro nível)
          try {
            const mp3Convert = await lambda
              .invoke({
                FunctionName: `convertAudioToOgg`,
                InvocationType: "RequestResponse",
                Payload: JSON.stringify({ base64Audio: audio, format: "mp3" }),
              })
              .promise();
            const mp3Payload = mp3Convert.Payload
              ? JSON.parse(mp3Convert.Payload.toString())
              : {};
            const mp3Base64: string = mp3Payload.body;
            if (!mp3Base64) {
              throw new Error("Conversão MP3 não retornou base64");
            }
            const mp3Buf = Buffer.from(
              mp3Base64.split(",").pop()?.trim() || "",
              "base64"
            );
            const mp3Sha = crypto
              .createHash("sha256")
              .update(mp3Buf)
              .digest("hex");
            console.log("MP3_FALLBACK_DEBUG", { bytes: mp3Buf.length, mp3Sha });
            const mp3Form = new FormData();
            mp3Form.append("file", mp3Buf, {
              filename: "audio.mp3",
              contentType: "audio/mpeg",
            });
            mp3Form.append("messaging_product", "whatsapp");
            let mp3Upload;
            try {
              mp3Upload = await axios.post(
                `${process.env.WHATSAPP_URL}/${whatsappIdConfig?.value}/media`,
                mp3Form,
                {
                  headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                  },
                }
              );
            } catch (mp3UpErr: any) {
              return {
                statusCode: mp3UpErr.response?.status || 500,
                body: JSON.stringify({
                  success: false,
                  msg: "Falha upload fallback MP3",
                  error: mp3UpErr.response?.data?.error?.message,
                  originalCode: wErr?.code,
                }),
              };
            }
            const mp3MediaId = mp3Upload.data.id;
            await new Promise((r) => setTimeout(r, 700));
            await pollMedia(mp3MediaId);
            try {
              const sendMp3 = await axios.post(
                `${process.env.WHATSAPP_URL}/${whatsappIdConfig?.value}/messages`,
                {
                  messaging_product: "whatsapp",
                  to: formattedNumber,
                  type: "audio",
                  audio: { id: mp3MediaId },
                },
                {
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                  },
                }
              );
              response = sendMp3;
              requestBody = {
                messaging_product: "whatsapp",
                to: formattedNumber,
                type: "audio",
                audio: { id: mp3MediaId },
              };
              console.log("FALLBACK MP3 SUCESSO", { mp3MediaId });
            } catch (sendMp3Err: any) {
              return {
                statusCode: sendMp3Err.response?.status || 500,
                body: JSON.stringify({
                  success: false,
                  msg: "Fallback MP3 falhou no envio.",
                  error: sendMp3Err.response?.data?.error?.message,
                  originalCode: wErr?.code,
                  attempts,
                  mediaId,
                  sha256,
                  headHex,
                }),
              };
            }
          } catch (mp3GlobalErr: any) {
            return {
              statusCode: 500,
              body: JSON.stringify({
                success: false,
                msg: "Erro no fallback MP3.",
                error: mp3GlobalErr.message,
                originalCode: wErr?.code,
                attempts,
                mediaId,
                sha256,
                headHex,
              }),
            };
          }
        }
      } else {
        return {
          statusCode: lastErr?.response?.status || 500,
          body: JSON.stringify({
            success: false,
            msg: "Falha ao enviar áudio após tentativas.",
            code: wErr?.code,
            details: wErr?.error_data,
            mediaId,
            sha256,
            headHex,
            attempts,
          }),
        };
      }
    }

    requestBody = {
      messaging_product: "whatsapp",
      to: formattedNumber,
      type: "audio",
      audio: { id: mediaId },
    };

    console.log(
      "WHATSAPP-API SEND AUDIO: Response SENDAUDIO status:",
      response.status
    );
    console.log(
      "WHATSAPP-API SEND AUDIO: Mensagem enviada com sucesso:",
      response.data
    );

    // Salvar mensagem no Firebase se o envio foi bem-sucedido
    if (response.status === 200) {
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
        // Preparar dados da mensagem
        const messageData: any = {
          body: "Áudio",
          from: whatsappConfig.value,
          id: response?.data?.messages[0].id,
          name: user?.profile?.name || userMaster?.profile?.name,
          timestamp: Math.floor(Date.now() / 1000), // Timestamp em segundos
          type: "audio",
        };

        // Incluir media_id se disponível
        if (requestBody?.audio?.id) {
          messageData.audio = {
            id: requestBody.audio.id,
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
          "WHATSAPP-API SEND AUDIO ERROR: Erro ao salvar mensagem no Firestore.",
          error
        );
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            msg: "Erro ao enviar mensagem de áudio.",
          }),
        };
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Mensagem de áudio enviada com sucesso.",
        data: {
          messageId: response.data.messages?.[0]?.id,
          contacts: response.data.contacts,
          whatsappResponse: response.data,
        },
      }),
    };
  } catch (error: any) {
    console.error("WHATSAPP SEND AUDIO ERROR:", error);

    // Erro da API do WhatsApp
    if (error.response?.data) {
      const whatsappError = error.response.data.error;
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
        }),
      };
    }

    // Erro genérico
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao enviar a mensagem de áudio. Tente novamente mais tarde.",
        error: error.message,
      }),
    };
  } finally {
    await database.disconnect();
  }
};
