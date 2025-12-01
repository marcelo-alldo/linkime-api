import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";
import axios from "axios";

/**
 * Função auxiliar para deletar mídia da Meta (WhatsApp) por MEDIA_ID
 */
const deleteMediaFromWhatsApp = async (
  mediaId: string,
  whatsappPhoneId?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_URL) {
      console.error("WHATSAPP_TOKEN ou WHATSAPP_URL não configurados");
      return {
        success: false,
        error: "Configuração do WhatsApp incompleta no servidor",
      };
    }

    if (!mediaId) {
      console.error("MEDIA_ID não fornecido para exclusão");
      return { success: false, error: "MEDIA_ID inválido" };
    }

    const url = `${process.env.WHATSAPP_URL}/${mediaId}`;

    const response = await axios.delete(url, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
      params: whatsappPhoneId ? { phone_number_id: whatsappPhoneId } : undefined,
    });

    console.log("Mídia excluída com sucesso:", {
      mediaId,
      success: response.data?.success,
    });

    return { success: !!response.data?.success };
  } catch (error: any) {
    console.error("Erro ao excluir mídia:", {
      mediaId,
      status: error.response?.status,
      error: error.response?.data || error.message,
    });

    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
};

/**
 * Função auxiliar para fazer upload de mídia para a Meta (WhatsApp)
 */
const uploadMediaToWhatsApp = async (
  media: string,
  mimeType: string,
  fileName: string,
  whatsappPhoneId: string // Receber diretamente o ID
): Promise<{ success: boolean; mediaId?: string; error?: string }> => {
  try {
    console.log("Iniciando upload de mídia para WhatsApp:", {
      fileName,
      mimeType,
      whatsappPhoneId,
    });

    // Validar variáveis de ambiente
    if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_URL) {
      console.error("WHATSAPP_TOKEN ou WHATSAPP_URL não configurados");
      return {
        success: false,
        error: "Configuração do WhatsApp incompleta no servidor",
      };
    }

    if (!whatsappPhoneId) {
      console.error("WHATSAPP-PHONE-ID não fornecido");
      return {
        success: false,
        error: "WHATSAPP-PHONE-ID não encontrado",
      };
    }

    // Converter base64 para Buffer
    const mediaBuffer = Buffer.from(media, "base64");

    // Preparar FormData
    const formData = new FormData();
    const mediaBlob = new Blob([mediaBuffer], { type: mimeType });
    formData.append("file", mediaBlob, fileName || "file");
    formData.append("type", mimeType);
    formData.append("messaging_product", "whatsapp");

    // Upload da mídia para o WhatsApp
    const uploadResponse = await axios.post(
      `${process.env.WHATSAPP_URL}/${whatsappPhoneId}/media`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
      }
    );

    console.log("Upload de mídia realizado com sucesso:", {
      mediaId: uploadResponse.data.id,
      fileName,
    });

    return {
      success: true,
      mediaId: uploadResponse.data.id,
    };
  } catch (error: any) {
    console.error("Erro ao fazer upload de mídia:", {
      fileName,
      status: error.response?.status,
      error: error.response?.data || error.message,
    });

    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
};

/**
 * Processa uploads de arquivos nos produtos
 */
const processProductFiles = async (
  productsData: any,
  whatsappPhoneId: string // Receber diretamente o ID
): Promise<any> => {
  if (!productsData || !Array.isArray(productsData.products)) {
    return productsData;
  }

  const processedProducts = [];

  for (const product of productsData.products) {
    const processedProduct = { ...product };

    // Se o produto tem arquivos, processar cada um
    if (product.files && Array.isArray(product.files)) {
      const processedFiles = [];

      for (const file of product.files) {
        // Se o arquivo já tem mediaId, não fazer upload novamente
        if (file.mediaId) {
          processedFiles.push(file);
          continue;
        }

        // Se o arquivo tem dados base64, fazer upload
        if (file.media && file.mimeType) {
          console.log(`Fazendo upload do arquivo: ${file.name}`);

          const uploadResult = await uploadMediaToWhatsApp(
            file.media,
            file.mimeType,
            file.name,
            whatsappPhoneId // Passar o ID diretamente
          );

          if (uploadResult.success) {
            // Salvar apenas informações necessárias, removendo o base64
            processedFiles.push({
              name: file.name,
              type: file.type,
              size: file.size,
              mediaId: uploadResult.mediaId,
              uploadStatus: "success",
            });
          } else {
            // Marcar como erro mas manter o arquivo
            processedFiles.push({
              name: file.name,
              type: file.type,
              size: file.size,
              uploadStatus: "error",
              error: uploadResult.error,
            });
          }
        } else {
          // Arquivo sem dados para upload (possivelmente já processado)
          processedFiles.push(file);
        }
      }

      processedProduct.files = processedFiles;
    }

    processedProducts.push(processedProduct);
  }

  return {
    ...productsData,
    products: processedProducts,
  };
};

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const { uid } = event.pathParameters || {};
  const { name, key, value, data } = JSON.parse(event.body || "");
  const subscriptionMiddleware = (await subscription(
    authorization.data.masterUid
  )) as {
    success: boolean;
  };

  // LOG: Received parameters
  console.log("CONFIG UPDATE: Parâmetros recebidos:", {
    name,
    key,
    value,
    hasData: !!data,
    uid,
    masterUid: authorization.data.masterUid,
  });

  try {
    if (!authorization) {
      console.error(
        "CONFIG UPDATE ERROR: Cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (
      authorization.data.role !== "admin" &&
      !subscriptionMiddleware.success
    ) {
      console.error("CONFIG UPDATE ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    if (!key) {
      console.error(
        "CONFIG UPDATE ERROR: Campo obrigatório não informado (key)."
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Requisição inválida: Campo obrigatório não informado (key).",
        }),
      };
    }

    let processedData = data;
    let uploadResults = {
      total: 0,
      success: 0,
      failed: 0,
    };
    let deletedMediaInfo: { total: number; deleted: number; failed: number } | null = null;

    // Se a chave for PRODUCTS, processar uploads de arquivos
    if (key === "PRODUCTS" && data) {
      try {
        const parsedData = typeof data === "string" ? JSON.parse(data) : data;

        console.log("CONFIG UPDATE: Dados dos produtos:", {
          hasProducts: !!parsedData.products,
          productsCount: parsedData.products?.length || 0,
        });

        // Buscar configuração atual para identificar mídias que devem ser excluídas
        const existingConfig = await database.client.userConfig.findUnique({
          where: { uid },
          select: { data: true },
        });

        const previousParsedData = existingConfig?.data
          ? typeof existingConfig.data === "string"
            ? JSON.parse(existingConfig.data as any)
            : (existingConfig.data as any)
          : null;

        const previousMediaIds = new Set<string>();
        previousParsedData?.products?.forEach((product: any) => {
          if (product.files && Array.isArray(product.files)) {
            product.files.forEach((file: any) => {
              if (file.mediaId) previousMediaIds.add(file.mediaId);
            });
          }
        });

        // Buscar configurações do WhatsApp para upload
        const userMaster = await database.client.user.findUnique({
          where: {
            uid: authorization.data.masterUid,
          },
          select: {
            configs: {
              where: {
                key: "WHATSAPP-PHONE-ID",
              },
            },
          },
        });

        console.log("CONFIG UPDATE: Configurações encontradas:", {
          hasUserMaster: !!userMaster,
          configsCount: userMaster?.configs?.length || 0,
          configs: userMaster?.configs,
        });

        if (userMaster && userMaster.configs && userMaster.configs.length > 0) {
          const whatsappIdConfig = userMaster.configs.find(
            (config) => config.key === "WHATSAPP-PHONE-ID"
          );

          if (whatsappIdConfig) {
            console.log(
              "CONFIG UPDATE: Processando uploads de arquivos dos produtos com ID:",
              whatsappIdConfig
            );

            // Contar arquivos antes do upload
            parsedData.products?.forEach((product: any) => {
              if (product.files && Array.isArray(product.files)) {
                uploadResults.total += product.files.filter(
                  (f: any) => f.media && !f.mediaId
                ).length;
              }
            });

            console.log(
              "CONFIG UPDATE: Total de arquivos para upload:",
              uploadResults.total
            );

            // Processar uploads passando o ID diretamente
            const processedProducts = await processProductFiles(
              parsedData,
              whatsappIdConfig.value
            );

            // Contar resultados
            processedProducts.products?.forEach((product: any) => {
              if (product.files && Array.isArray(product.files)) {
                product.files.forEach((file: any) => {
                  if (file.uploadStatus === "success") uploadResults.success++;
                  if (file.uploadStatus === "error") uploadResults.failed++;
                });
              }
            });

            console.log("CONFIG UPDATE: Resultados do upload:", uploadResults);

            // Calcular mídias que precisam ser excluídas (não vieram no payload novo)
            const newMediaIds = new Set<string>();
            processedProducts.products?.forEach((product: any) => {
              if (product.files && Array.isArray(product.files)) {
                product.files.forEach((file: any) => {
                  if (file.mediaId) newMediaIds.add(file.mediaId);
                });
              }
            });

            const idsToDelete: string[] = [];
            previousMediaIds.forEach((id) => {
              if (!newMediaIds.has(id)) idsToDelete.push(id);
            });

            if (idsToDelete.length > 0) {
              console.log(
                "CONFIG UPDATE: Mídias a excluir por remoção de arquivos:",
                idsToDelete
              );

              deletedMediaInfo = { total: idsToDelete.length, deleted: 0, failed: 0 };

              for (const mediaId of idsToDelete) {
                const del = await deleteMediaFromWhatsApp(
                  mediaId,
                  whatsappIdConfig.value
                );
                if (del.success) deletedMediaInfo.deleted++;
                else deletedMediaInfo.failed++;
              }

              console.log("CONFIG UPDATE: Exclusões de mídia realizadas:", deletedMediaInfo);
            }

            // Converter de volta para string se necessário
            processedData = JSON.stringify(processedProducts);

            console.log("CONFIG UPDATE: Uploads processados com sucesso");
          } else {
            console.warn(
              "CONFIG UPDATE: WHATSAPP-PHONE-ID não tem valor, arquivos não serão enviados"
            );
          }
        } else {
          console.warn(
            "CONFIG UPDATE: Configuração do WhatsApp não encontrada, arquivos não serão enviados para Meta"
          );
        }
      } catch (parseError) {
        console.error(
          "CONFIG UPDATE ERROR: Erro ao processar dados dos produtos:",
          parseError
        );
        // Continuar com os dados originais se houver erro
      }
    }

    console.log("CONFIG UPDATE: Tentando atualizar configuração:", {
      uid,
      key,
      name,
      hasData: !!processedData,
    });

    // Atualizar configuração com os dados processados
    const config = await database.client.userConfig.update({
      where: {
        uid,
      },
      data: {
        key,
        value,
        name,
        data: processedData,
      },
    });

    if (!config) {
      console.error("CONFIG UPDATE ERROR: Configuração não encontrada.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Configuração não encontrada.",
        }),
      };
    }

    console.log("CONFIG UPDATE: Configuração atualizada com sucesso:", {
      uid: config.uid,
      key: config.key,
      userUid: config.userUid,
    });

    // Lógica específica para ALLDO_STATUS
    if (key === "ALLDO_STATUS" && value === "PENDING") {
      // Envia mensagem para o webhook do Discord
      try {
        const webhookUrl = process.env.DISCORD_ALLDO_PENDING_WEBHOOK_URL;
        if (webhookUrl) {
          await axios.post(webhookUrl, {
            content: `Status ALLDO alterado para PENDING pelo usuário ${
              authorization.data.masterUid || "desconhecido"
            }.`,
          });
          console.log("Mensagem enviada para o Discord webhook com sucesso.");
        } else {
          console.warn("DISCORD_WEBHOOK_URL não configurado no ambiente.");
        }
      } catch (err) {
        console.error("Erro ao enviar mensagem para o Discord webhook:", err);
      }
    }

    if (key === "ALLDO_STATUS" && value === "FINISHED") {
      if (authorization.data.role === "admin") {
        console.log(
          "CONFIG UPDATE INFO: Atualizando assinatura do usuario:",
          uid
        );
        const userSubscription =
          await database.client.userSubscription.findFirst({
            where: {
              userUid: config.userUid,
              status: {
                in: ["ACTIVE"],
              },
            },
          });

        if (!userSubscription) {
          console.error(
            "CONFIG UPDATE ERROR: Assinatura do usuário não encontrada."
          );
          return {
            statusCode: 404,
            body: JSON.stringify({
              success: false,
              msg: "Assinatura do usuário não encontrada.",
            }),
          };
        }

        const startDate = new Date();
        const endDate =
          userSubscription?.type === "MONTHLY"
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        await database.client.userSubscription.update({
          where: {
            uid: userSubscription?.uid,
          },
          data: {
            startDate,
            endDate,
          },
        });
      } else {
        console.error(
          "CONFIG UPDATE ERROR: Somente administradores podem finalizar o ALLDO."
        );
      }
    }

    const response: any = {
      success: true,
      msg: "Configuração atualizada com sucesso.",
    };

    // Adicionar informações de upload se relevante
    if (uploadResults.total > 0) {
      response.uploadResults = uploadResults;
    }

    // Adicionar informações de exclusão de mídia se relevante
    if (deletedMediaInfo && deletedMediaInfo.total > 0) {
      response.deletedMedia = deletedMediaInfo;
    }

    // LOG: Config updated successfully
    console.log(
      "CONFIG UPDATE SUCCESS: Configuração atualizada com sucesso.",
      config
    );
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    // LOG: Full error
    console.error("CONFIG UPDATE ERROR: Falha ao atualizar configuração.", {
      error: error.message,
      stack: error.stack,
      code: error.code,
    });
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao atualizar configuração. Por favor, tente novamente mais tarde.",
        error: error.message,
      }),
    };
  } finally {
    await database.disconnect();
  }
};