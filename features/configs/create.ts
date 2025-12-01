import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";
import axios from "axios";

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
  const { name, key, value, data, uid } = JSON.parse(event.body || "");
  const subscriptionMiddleware = (await subscription(
    authorization.data.masterUid
  )) as {
    success: boolean;
  };

  // LOG: Received parameters
  console.log("CONFIG CREATE: Parâmetros recebidos:", {
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
        "CONFIG CREATE ERROR: Cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (!subscriptionMiddleware.success && !uid) {
      console.error("CONFIG CREATE ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    if (!name || !key || !value) {
      console.error(
        "CONFIG CREATE ERROR: Campos obrigatórios não informados (name, key, value)."
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Requisição inválida: Campos obrigatórios não informados (name, key, value).",
        }),
      };
    }

    let processedData = data;
    let uploadResults = {
      total: 0,
      success: 0,
      failed: 0,
    };

    // Se a chave for PRODUCTS, processar uploads de arquivos
    if (key === "PRODUCTS" && data) {
      try {
        const parsedData = typeof data === "string" ? JSON.parse(data) : data;

        console.log("CONFIG CREATE: Dados dos produtos:", {
          hasProducts: !!parsedData.products,
          productsCount: parsedData.products?.length || 0,
        });

        // Buscar configurações do WhatsApp para upload
        const userMaster = await database.client.user.findUnique({
          where: {
            uid: uid || authorization.data.masterUid,
          },
          select: {
            configs: {
              where: {
                key: "WHATSAPP-PHONE-ID",
              },
            },
          },
        });

        console.log("CONFIG CREATE: Configurações encontradas:", {
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
              "CONFIG CREATE: Processando uploads de arquivos dos produtos com ID:",
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
              "CONFIG CREATE: Total de arquivos para upload:",
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

            console.log("CONFIG CREATE: Resultados do upload:", uploadResults);

            // Converter de volta para string se necessário
            processedData = JSON.stringify(processedProducts);

            console.log("CONFIG CREATE: Uploads processados com sucesso");
          } else {
            console.warn(
              "CONFIG CREATE: WHATSAPP-PHONE-ID não tem valor, arquivos não serão enviados"
            );
          }
        } else {
          console.warn(
            "CONFIG CREATE: Configuração do WhatsApp não encontrada, arquivos não serão enviados para Meta"
          );
        }
      } catch (parseError) {
        console.error(
          "CONFIG CREATE ERROR: Erro ao processar dados dos produtos:",
          parseError
        );
        // Continuar com os dados originais se houver erro
      }
    }

    const userUidToUse = uid || authorization.data.masterUid;

    console.log("CONFIG CREATE: Tentando criar configuração:", {
      userUid: userUidToUse,
      key,
      name,
      hasData: !!processedData,
    });

    // Criar configuração com os dados processados
    const createdConfig = await database.client.userConfig.create({
      data: {
        userUid: userUidToUse,
        key,
        value,
        name,
        data: processedData,
      },
    });

    console.log("CONFIG CREATE: Configuração criada com sucesso:", {
      uid: createdConfig.uid,
      key: createdConfig.key,
      userUid: createdConfig.userUid,
    });

    const response: any = {
      success: true,
      msg: "Configuração criada com sucesso.",
    };

    // Adicionar informações de upload se relevante
    if (uploadResults.total > 0) {
      response.uploadResults = uploadResults;
    }

    return {
      statusCode: 201,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error("CONFIG CREATE ERROR: Falha ao criar configuração.", {
      error: error.message,
      stack: error.stack,
      code: error.code,
    });
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao criar configuração. Por favor, tente novamente mais tarde.",
        error: error.message,
      }),
    };
  } finally {
    await database.disconnect();
  }
};
