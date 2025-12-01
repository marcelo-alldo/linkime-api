import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const subscriptionMiddleware = (await subscription(authorization.data.masterUid)) as { success: boolean };

  const {
    enable,
    profileUpdate,
    email,
    name,
    phone,
    cpf,
    summary,
    notes,
    birthDate,
    cnpj,
    fantasyName,
    addressUpdate,
    address,
    complement,
    cityUid,
    latitude,
    longitude,
    neighborhood,
    number,
    zipCode,
    documentUpdate,
  } = JSON.parse(event.body || "{}");

  const { uid } = event.pathParameters || {};

  console.log("Received parameters:", {
    enable,
    profileUpdate,
    email,
    name,
    phone,
    cpf,
    summary,
    notes,
    birthDate,
    cnpj,
    fantasyName,
    addressUpdate,
    address,
    complement,
    cityUid,
    latitude,
    longitude,
    neighborhood,
    number,
    zipCode,
    documentUpdate,
  });

  try {
    if (!authorization) {
      console.error("CLIENT UPDATE ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido." }),
      };
    }

    if (!subscriptionMiddleware.success) {
      console.error("CLIENT UPDATE ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, msg: "Assinatura inválida ou expirada." }),
      };
    }

    if (!uid) {
      console.error("CLIENT UPDATE ERROR: Campo obrigatório não informado (uid).");
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, msg: "Requisição inválida: Campo obrigatório não informado (uid)." }),
      };
    }

    // Buscar cliente
    const client = await database.client.client.findUnique({
      where: { uid },
      select: { uid: true, enable: true },
    });

    if (!client) {
      console.error("CLIENT UPDATE ERROR: Cliente não encontrado.");
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, msg: "Cliente não encontrado." }),
      };
    }

    // Atualizar status de enable
    if (typeof enable === "boolean") {
      const updatedClient = await database.client.client.update({
        where: { uid },
        data: { enable: !client.enable },
      });
      console.log("CLIENT UPDATE SUCCESS: Status de enable do cliente alterado com sucesso.", updatedClient);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          msg: "Status de enable do cliente alterado com sucesso.",
          data: updatedClient,
        }),
      };
    }

    // Atualizar perfil do cliente
    if (profileUpdate) {
      const profileData: any = {};
      if (email !== undefined) profileData.email = email;
      if (name !== undefined) profileData.name = name;
      if (phone !== undefined) profileData.phone = phone;
      if (cpf !== undefined) profileData.cpf = cpf;
      if (summary !== undefined) profileData.summary = summary;
      if (notes !== undefined) profileData.notes = notes;
      if (birthDate) profileData.birthDate = new Date(birthDate);
      if (cnpj !== undefined) profileData.cnpj = cnpj;
      if (fantasyName !== undefined) profileData.fantasyName = fantasyName;

      console.log(profileData, 'PROFILE DATA')

      if (Object.keys(profileData).length > 0) {
        const updatedProfile = await database.client.client.update({
          where: { uid: client.uid },
          data: { clientProfile: { update: profileData } },
        });
        console.log("CLIENT UPDATE SUCCESS: Perfil do cliente atualizado com sucesso.", updatedProfile);
      }
    }

    // Atualizar endereço do cliente
    if (addressUpdate) {
      const addressData: any = {
        address,
        complement,
        neighborhood,
        number,
        latitude,
        longitude,
        zipCode,
        point: `POINT(${longitude} ${latitude})`,
      };
      if (cityUid) {
        addressData.city = { connect: { uid: cityUid } };
      }

      const updatedAddress = await database.client.client.update({
        where: { uid: client.uid },
        data: {
          address: {
            upsert: {
              create: addressData,
              update: addressData,
            },
          },
        },
      });
      console.log("CLIENT UPDATE SUCCESS: Endereço do cliente atualizado com sucesso.", updatedAddress);
    }

    console.log("CLIENT UPDATE SUCCESS: Cliente atualizado com sucesso.");
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Cliente atualizado com sucesso.",
      }),
    };
  } catch (error) {
    console.error("CLIENT UPDATE ERROR: Falha ao atualizar cliente.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao atualizar cliente. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
