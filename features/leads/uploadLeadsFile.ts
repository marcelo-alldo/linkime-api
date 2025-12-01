import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import * as XLSX from "xlsx";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const subscriptionMiddleware = (await subscription(
    authorization.data.masterUid
  )) as {
    success: boolean;
  };

  try {
    if (!authorization) {
      console.error(
        "UPLOAD LEADS FILE ERROR: Cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (!subscriptionMiddleware.success) {
      console.error(
        "UPLOAD LEADS FILE ERROR: Assinatura inválida ou expirada."
      );
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    // Busca o total de leads do usuário na etapa inicial
    const totalLeads = await database.client.lead.count({
      where: {
        userUid: authorization.data.masterUid,
      },
    });

    // Verifica se o usuário tem leads na etapa inicial e em sua assinatur
    switch (authorization.data.subscription) {
      case process.env.SUBSCRIPTION_FREE_TRIAL_UID:
        if (totalLeads > 0) {
          return {
            statusCode: 403,
            body: JSON.stringify({
              success: false,
              msg: "Sua assinatura é apenas para teste, você pode testar com um contato apenas.",
            }),
          };
        }
        break;

      case process.env.SUBSCRIPTION_SERVICE_UID:
        if (totalLeads >= 500) {
          return {
            statusCode: 403,
            body: JSON.stringify({
              success: false,
              msg: "Sua assinatura permite apenas 500 contatos, mas você pode alterar quando quiser.",
            }),
          };
        }
        break;

      case process.env.SUBSCRIPTION_DEFAULT_UID:
        if (totalLeads >= 1000) {
          return {
            statusCode: 403,
            body: JSON.stringify({
              success: false,
              msg: "Sua assinatura permite apenas 1000 contatos, mas você pode alterar quando quiser.",
            }),
          };
        }
        break;

      case process.env.SUBSCRIPTION_CUSTOM_UID:
        if (totalLeads >= 5000) {
          return {
            statusCode: 403,
            body: JSON.stringify({
              success: false,
              msg: "Sua assinatura permite apenas 5000 contatos, caso precise alterar contate o especialista.",
            }),
          };
        }
        break;

      default:
        break;
    }

    // Verifica se veio body
    if (!event.body) {
      console.error("UPLOAD LEADS FILE ERROR: Nenhum arquivo enviado.");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Nenhum arquivo enviado.",
        }),
      };
    }

    // Faz o parse do body para pegar o campo 'body' (que contém o base64 com prefixo)
    let fileBase64: string | undefined;
    let base64WithPrefix: string | undefined;
    try {
      let bodyParsed: any;
      if (typeof event.body === "string") {
        try {
          bodyParsed = JSON.parse(event.body);
        } catch (e) {
          // Se não for JSON, pode ser o próprio base64 com prefixo
          base64WithPrefix = event.body;
        }
      } else {
        bodyParsed = event.body;
      }
      if (bodyParsed && bodyParsed.body) {
        base64WithPrefix = bodyParsed.body;
      }
      if (base64WithPrefix) {
        const commaIndex = base64WithPrefix.indexOf(",");
        fileBase64 =
          commaIndex !== -1
            ? base64WithPrefix.substring(commaIndex + 1)
            : base64WithPrefix;
      }
    } catch (e) {
      console.error("UPLOAD LEADS FILE ERROR: JSON do body inválido.", e);
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "JSON do body inválido.",
        }),
      };
    }

    // LOG: Received event.body
    console.log("Received event.body:", event.body);

    // LOG: fileBase64 and base64WithPrefix after parsing
    console.log("fileBase64:", fileBase64?.substring(0, 100));
    console.log("base64WithPrefix:", base64WithPrefix?.substring(0, 100));

    if (!fileBase64) {
      console.error(
        "UPLOAD LEADS FILE ERROR: Nenhum campo de arquivo extraído do body."
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Nenhum campo de arquivo enviado.",
        }),
      };
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(fileBase64, "base64");

    // LOG: Buffer preview
    console.log("Buffer (first 20 bytes):", buffer.slice(0, 20));

    // Read Excel file
    let workbook;
    try {
      workbook = XLSX.read(buffer, { type: "buffer" });
    } catch (err) {
      console.error("Error reading Excel file:", err);
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Uploaded file is not a valid Excel file.",
          error: err.message,
        }),
      };
    }
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const leads: Array<{ Nome: string; Email: string; Telefone: string }> =
      XLSX.utils.sheet_to_json(sheet);

    // LOG: Extracted leads
    console.log("Extracted leads:", leads);

    if (!Array.isArray(leads) || leads.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "No leads found in file (uploadLeadsFile).",
        }),
      };
    }

    console.log("LEADS", leads);

    // Busca a última posição atual
    const lastLead = await database.client.lead.findFirst({
      where: {
        userUid: authorization.data.masterUid,
        stepUid: process.env.FIRST_STEP_UID,
      },
      orderBy: {
        position: "desc",
      },
      select: {
        position: true,
      },
    });

    let nextPosition =
      lastLead && lastLead.position ? lastLead.position + 1 : 1;

    // Prepara os dados para inserção em massa
    const dataToInsert = leads
      .filter((l) => l.Nome && l.Telefone)
      .map((l) => ({
        email: l.Email,
        name: l.Nome,
        phone: l.Telefone,
        position: nextPosition++,
        userUid: authorization.data.masterUid,
        stepUid: process.env.FIRST_STEP_UID,
      }));

    // LOG: Data to insert
    console.log("Data to insert:", dataToInsert);

    if (dataToInsert.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "No valid leads to insert (uploadLeadsFile).",
        }),
      };
    }

    await database.client.lead.createMany({
      data: dataToInsert,
    });

    console.log(
      "UPLOAD LEADS FILE SUCCESS: Arquivo de leads processado com sucesso."
    );
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Arquivo de leads processado com sucesso.",
      }),
    };
  } catch (error) {
    // LOG: Full error
    console.error(
      "UPLOAD LEADS FILE ERROR: Falha ao processar arquivo de leads.",
      error
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao processar arquivo de leads. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
