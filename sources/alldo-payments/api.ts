const baseUrl = process.env.ALLDO_PAYMENTS_API_URL;
const apiKey = process.env.ALLDO_PAYMENTS_ACCESS_TOKEN;

async function doGet(url: string) {
  try {
    const response = await fetch(`${baseUrl}${url}`, {
      method: "GET",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
  }
}

async function doPost(url: string, body: any) {
  try {
    const response = await fetch(`${baseUrl}${url}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
  }
}

async function doDelete(url: string) {
  try {
    const response = await fetch(`${baseUrl}${url}`, {
      method: "DELETE",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
  }
}

export { doGet, doPost, doDelete };