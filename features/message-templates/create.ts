import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { MessageTemplateStatus, MessageTemplateType } from "@prisma/client";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";

interface WhatsAppComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
  buttons?: WhatsAppButton[];
}

interface WhatsAppButton {
  type:
    | "QUICK_REPLY"
    | "URL"
    | "PHONE_NUMBER"
    | "OTP"
    | "MPM"
    | "CATALOG"
    | "FLOW"
    | "VOICE_CALL"
    | "APP";
  text?: string;
  url?: string;
  phone_number?: string;
  example?: string[];
}

interface WhatsAppTemplateRequest {
  name: string;
  category: "MARKETING" | "UTILITY";
  language?: string;
  components?: WhatsAppComponent[];
  parameter_format?: "NAMED" | "POSITIONAL";
  library_template_name?: string;
  library_template_body_inputs?: any[];
  message?: string;
}

interface MetaApiResponse {
  id?: string;
  status?: string;
  category?: string;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

// Função para construir mensagem a partir dos componentes
const buildMessageFromComponents = (
  components: WhatsAppComponent[] = []
): string => {
  const bodyComponent = components.find((comp) => comp.type === "BODY");
  return bodyComponent?.text || "";
};

// Função para normalizar o nome do template para o padrão da Met
const normalizeTemplateName = (name: string): string => {
  return name
    .toLowerCase() // Converter para minúsculo
    .replace(/[^a-z0-9]/g, "_") // Substituir caracteres especiais por underscore
    .replace(/_+/g, "_") // Remover underscores duplicados
    .replace(/^_|_$/g, ""); // Remover underscores no início e fim
};

// Função para criar componentes padrão se não foram fornecidos
const createDefaultComponents = (message: string): WhatsAppComponent[] => {
  return [
    {
      type: "BODY",
      text: message,
    },
  ];
};

// Função para validar e preparar componentes
const validateAndPrepareComponents = (
  templateData: WhatsAppTemplateRequest
): { components: WhatsAppComponent[]; errors: string[] } => {
  const errors: string[] = [];
  let components = templateData.components || [];

  if (!components || components.length === 0) {
    if (templateData.message && templateData.message.trim()) {
      components = createDefaultComponents(templateData.message.trim());
    } else {
      errors.push("É necessário fornecer 'components' ou 'message'.");
      return { components: [], errors };
    }
  }

  // Validar se existe pelo menos um componente BODY (se usando components)
  if (components.length > 0) {
    const hasBodyComponent = components.some((comp) => comp.type === "BODY");
    if (!hasBodyComponent) {
      errors.push("É necessário ter pelo menos um componente do tipo 'BODY'.");
    }

    // Validar texto dos componentes BODY
    const bodyComponents = components.filter((comp) => comp.type === "BODY");
    for (const bodyComp of bodyComponents) {
      if (!bodyComp.text || bodyComp.text.trim().length === 0) {
        errors.push("Componente 'BODY' deve conter texto não vazio.");
      }
    }
  }

  return { components, errors };
};

// Função para enviar template para aprovação da Meta
const submitTemplateToMeta = async (
  templateData: WhatsAppTemplateRequest,
  whatsappBusinessAccountId: string,
  accessToken: string
): Promise<MetaApiResponse> => {
  try {
    const metaApiUrl = `https://graph.facebook.com/v18.0/${whatsappBusinessAccountId}/message_templates`;

    // ✅ Normalizar o nome do template para o padrão da Meta
    const normalizedName = normalizeTemplateName(templateData.name);

    // ✅ Validar e preparar componentes
    const { components, errors } = validateAndPrepareComponents(templateData);

    if (errors.length > 0) {
      return {
        error: {
          message: errors.join("; "),
          type: "validation_error",
          code: 400,
        },
      };
    }

    const payload: any = {
      name: normalizedName,
      category: templateData.category,
      language: templateData.language || "pt_BR",
      parameter_format: templateData.parameter_format || "POSITIONAL",
    };

    payload.components = components;

    const response = await fetch(metaApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseData = (await response.json()) as MetaApiResponse;

    if (!response.ok) {
      console.error("Meta API Error:", responseData);

      // Tratamento específico para erro de nome duplicado
      if (
        (responseData.error as any)?.error_subcode === 2388024 ||
        (responseData.error as any)?.error_user_title ===
          "Content in This Language Already Exists"
      ) {
        return {
          error: {
            message:
              "Este nome de template já existe ou foi usado recentemente. Os nomes de templates aprovados que foram excluídos não podem ser reutilizados por 30 dias. Tente usar um nome diferente.",
            type: "duplicate_template_name",
            code: responseData.error?.code || response.status,
          },
        };
      }

      return {
        error: {
          message:
            responseData.error?.message || "Erro desconhecido da API da Meta",
          type: responseData.error?.type || "unknown_error",
          code: responseData.error?.code || response.status,
        },
      };
    }

    return {
      id: responseData.id,
      status: responseData.status || "PENDING",
      category: responseData.category,
    };
  } catch (error) {
    console.error("Erro ao enviar template para Meta:", error);
    return {
      error: {
        message:
          error instanceof Error
            ? error.message
            : "Erro de conexão com a API da Meta",
        type: "network_error",
        code: 500,
      },
    };
  }
};

const validateRequiredFields = (
  body: any
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (
    !body.name ||
    typeof body.name !== "string" ||
    body.name.trim().length === 0
  ) {
    errors.push("Campo 'name' é obrigatório e deve ser uma string não vazia.");
  }

  if (body.name && body.name.length > 512) {
    errors.push("Campo 'name' deve ter no máximo 512 caracteres.");
  }

  if (!body.category || !["MARKETING", "UTILITY"].includes(body.category)) {
    errors.push(
      "Campo 'category' é obrigatório e deve ser MARKETING ou UTILITY."
    );
  }

  // ✅ Validar se pelo menos um dos campos de conteúdo está presente
  const hasComponents =
    body.components &&
    Array.isArray(body.components) &&
    body.components.length > 0;
  const hasLibraryTemplate =
    body.library_template_name &&
    typeof body.library_template_name === "string";
  const hasMessage =
    body.message &&
    typeof body.message === "string" &&
    body.message.trim().length > 0;

  if (!hasComponents && !hasLibraryTemplate && !hasMessage) {
    errors.push(
      "É necessário fornecer 'components' ou 'message'."
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();

  try {
    const authorization = (await auth(event)) as {
      success: boolean;
      data: any;
    };

    // ✅ Verificar authorization.success
    if (!authorization.success) {
      console.error(
        "MESSAGE TEMPLATES CREATE ERROR: Cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    const subscriptionMiddleware = (await subscription(
      authorization.data.masterUid
    )) as {
      success: boolean;
    };

    if (!subscriptionMiddleware.success) {
      console.error(
        "MESSAGE TEMPLATES CREATE ERROR: Assinatura inválida ou expirada."
      );
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    const body: WhatsAppTemplateRequest = JSON.parse(event.body || "{}");

    const requiredFieldsValidation = validateRequiredFields(body);
    if (!requiredFieldsValidation.isValid) {
      console.error(
        "MESSAGE TEMPLATES CREATE ERROR: Campos obrigatórios inválidos.",
        requiredFieldsValidation.errors
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Dados inválidos.",
          errors: requiredFieldsValidation.errors,
        }),
      };
    }

    // ✅ Buscar configurações do usuário primeiro
    const configs = await database.client.userConfig.findMany({
      where: {
        userUid: authorization.data.masterUid,
        key: { in: ["WHATSAPP-ACCOUNT-ID"] },
      },
    });

    console.log("configs encontradas:", configs);

    // Validar se as configurações foram encontradas
    if (!configs || configs.length === 0) {
      console.error(
        "MESSAGE TEMPLATES CREATE ERROR: Configurações do WhatsApp Business não encontradas."
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Configurações do WhatsApp Business não encontradas.",
        }),
      };
    }

    const whatsappBusinessIdConfig = configs.find(
      (config) => config.key === "WHATSAPP-ACCOUNT-ID"
    );
    const metaAccessTokenConfig = process.env.WHATSAPP_TOKEN;

    if (!whatsappBusinessIdConfig || !metaAccessTokenConfig) {
      console.error(
        "MESSAGE TEMPLATES CREATE ERROR: Configurações incompletas do WhatsApp Business."
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Configurações incompletas.",
        }),
      };
    }

    const userWhatsappBusinessAccountId = whatsappBusinessIdConfig.value;

    let metaResponse: MetaApiResponse;
    let initialStatus;

    try {
      metaResponse = await submitTemplateToMeta(
        body,
        userWhatsappBusinessAccountId,
        metaAccessTokenConfig
      );

      if (metaResponse.error) {
        console.error(
          "MESSAGE TEMPLATES CREATE ERROR: Erro na API da Meta:",
          metaResponse.error
        );
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            msg: "Erro ao enviar template para aprovação da Meta.",
            error: metaResponse.error.message,
          }),
        };
      }

      if (metaResponse.id) {
        console.log(metaResponse, '--------------------------------------------------------------')
        initialStatus = metaResponse.status || MessageTemplateStatus.PENDING;
        console.log(
          "Template enviado para Meta com sucesso. ID:",
          metaResponse.id
        );
      }
    } catch (error) {
      console.error(
        "MESSAGE TEMPLATES CREATE ERROR: Falha ao comunicar com API da Meta:",
        error
      );
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg: "Falha ao comunicar com a API da Meta. Tente novamente mais tarde.",
          error: error instanceof Error ? error.message : "Erro desconhecido",
        }),
      };
    }

    const result = await database.client.$transaction(async (prisma) => {
      const masterUser = await prisma.user.findUnique({
        where: { uid: authorization.data.masterUid },
      });

      if (!masterUser) {
        throw new Error("Usuário não encontrado.");
      }

      // ✅ Construir mensagem a partir dos componentes ou usar message diretamente
      let messageText = "";
      if (body.components && body.components.length > 0) {
        messageText = buildMessageFromComponents(body.components);
      } else if (body.message) {
        messageText = body.message.trim();
      } else {
        messageText = body.name;
      }

      // Mapear categoria do WhatsApp para enum do Prisma
      let categoryEnum: MessageTemplateType;
      switch (body.category) {
        case "MARKETING":
          categoryEnum = MessageTemplateType.MARKETING;
          break;
        case "UTILITY":
        default:
          categoryEnum = MessageTemplateType.UTILITY;
          break;
      }

      const createdMessage = await prisma.messageTemplate.create({
        data: {
          name: body.name.trim(),
          category: categoryEnum,
          message: messageText,
          enable: true,
          status: initialStatus,
          userUid: masterUser.uid,
          metaTemplateId: metaResponse.id,
        },
      });

      return {
        createdMessage,
        whatsappData: {
          name: body.name,
          category: body.category,
          language: body.language || "pt_BR",
          components: body.components || createDefaultComponents(messageText),
          parameter_format: body.parameter_format || "POSITIONAL",
        },
      };
    });

    console.log(
      "MESSAGE TEMPLATES SUCCESS: Modelo de mensagem criado com sucesso.",
      result.createdMessage.uid
    );

    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        msg: "Modelo de mensagem criado com sucesso.",
        data: {
          uid: result.createdMessage.uid,
          name: result.createdMessage.name,
          category: result.createdMessage.category,
          status: result.createdMessage.status,
          whatsapp_template: result.whatsappData,
        },
      }),
    };
  } catch (error) {
    console.error(
      "MESSAGE TEMPLATES CREATE ERROR: Falha ao criar modelo de mensagem.",
      error
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao criar modelo de mensagem. Por favor, tente novamente mais tarde.",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
