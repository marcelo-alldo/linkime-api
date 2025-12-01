import Database from "../../../database";
import * as AWS from "aws-sdk";

const s3 = new AWS.S3();

export const handler = async () => {
  const database = new Database();

  try {
    const files = await database.client.file.findMany();

    for (const file of files) {
      const publicUrl = s3.getSignedUrl("getObject", {
        Bucket: process.env.BUCKET_NAME,
        Key: file.key,
        Expires: 60 * 60 * 4,
      });

      await database.client.file.update({
        where: { uid: file.uid },
        data: { publicUrl },
      });
    }

    console.log("REFRESH IMAGES SUCCESS: Imagens das empresas atualizadas com sucesso.");
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Imagens das empresas atualizadas com sucesso.",
      }),
    };
  } catch (error) {
    console.error("REFRESH IMAGES ERROR: Falha ao atualizar imagens das empresas.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao atualizar imagens das empresas.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
