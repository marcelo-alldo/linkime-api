import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import * as bcrypt from "bcryptjs";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const { uid } = event.pathParameters || {};
  const { enable, profileUpdate, paymentInfosUpdate, password, name, phone, cpf, birthDate, cnpj, fantasyName } =
    JSON.parse(event.body || "");

  try {
    if (!authorization) {
      console.error("USER UPDATE ERROR: Não autorizado: cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (enable !== undefined) {
      await database.client.user.update({
        where: {
          uid,
        },
        data: {
          enable,
        },
      });

      console.log("USER UPDATE SUCCESS: Usuário ativado/desativado com sucesso.");

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          msg: "Usuário ativado/desativado com sucesso.",
        }),
      };
    }

    if (profileUpdate) {
      await database.client.user.update({
        where: {
          uid,
        },
        data: {
          profile: {
            update: {
              name,
              phone,
              cpf,
              birthDate: birthDate ? new Date(birthDate) : null,
              cnpj,
              fantasyName,
            },
          },
        },
      });
      console.log("USER UPDATE SUCCESS: Perfil do usuário atualizado com sucesso.");
    }

    if (paymentInfosUpdate) {
      console.log("USER UPDATE SUCCESS: Informações de pagamento do usuário atualizados com sucesso.");
    }

    if (password) {
      await database.client.user.update({
        where: {
          uid,
        },
        data: {
          password: await bcrypt.hash(password, 10),
        },
      });

      console.log("USER UPDATE SUCCESS: Senha do usuário atualizada com sucesso.");
    }

    console.log("USER UPDATE SUCCESS: Usuário atualizado com sucesso.");
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Usuário atualizado com sucesso.",
      }),
    };
  } catch (error) {
    console.error("USER UPDATE ERROR: Falha ao atualizar usuário.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao atualizar usuário. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
