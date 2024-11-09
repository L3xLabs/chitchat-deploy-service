import axios from "axios";

const BASE_URL = "https://porkbun.com/api/json/v3";

export interface DNSRecordParams {
  domain: string;
  type: string;
  name: string;
  content: string;
  prio?: number;
  ttl?: number;
}

interface DNSRecord {
  id: string;
  name: string;
  type: string;
  content: string;
  ttl: string;
  prio: string;
  notes: string | null;
}

interface RetrieveDNSRecordsResponse {
  status: string;
  records: DNSRecord[];
}

export async function listDNSRecords(
  apiKey: string,
  secretApiKey: string,
  domain: string,
) {
  try {
    const response = await axios.post<RetrieveDNSRecordsResponse>(
      `${BASE_URL}/dns/retrieve/${domain}`,
      {
        apikey: apiKey,
        secretapikey: secretApiKey,
      },
    );

    if (response.data.status !== "SUCCESS") {
      console.error("Error retrieving DNS records");
      return;
    }

    const records = response.data.records;
    console.log("DNS Records:");
    records.forEach((record: DNSRecord) => {
      console.log(
        `ID: ${record.id}, Name: ${record.name}, Type: ${record.type}, Content: ${record.content}, TTL: ${record.ttl}`,
      );
    });

    return records;
  } catch (error) {
    console.error("Failed to retrieve DNS records:", error);
  }
}

export async function createDNSRecord(
  params: DNSRecordParams,
  apiKey: string,
  secretApiKey: string,
): Promise<{ ok: boolean; msg: string }> {
  const { domain, type, name, content, ttl, prio = 0 } = params;

  try {
    const response = await axios.post(`${BASE_URL}/dns/create/${domain}`, {
      apikey: apiKey,
      secretapikey: secretApiKey,
      type,
      name,
      content,
      ttl,
      prio,
    });

    if (response.data.status === "SUCCESS") {
      console.log("DNS record created successfully:", response.data);
      return { ok: true, msg: `DNS Record for host:- ${name} created!` };
    } else {
      console.error("Error creating DNS record:", response.data.message);
      return {
        ok: false,
        msg: `Failed to create DNS record for host:- ${name}`,
      };
    }
  } catch (error) {
    console.error("Failed to create DNS record:", error);
    return { ok: false, msg: "Internal Server Error" };
  }
}

export async function deleteDNSRecord(
  params: DNSRecordParams,
  apiKey: string,
  secretApiKey: string,
) {
  let { domain, type, name, content } = params;
  name = name ? name + "." + domain : domain;
  try {
    // Step 1: Retrieve all DNS records for the domain
    const listResponse = await axios.post<RetrieveDNSRecordsResponse>(
      `${BASE_URL}/dns/retrieve/${domain}`,
      {
        apikey: apiKey,
        secretapikey: secretApiKey,
      },
    );

    if (listResponse.data.status !== "SUCCESS") {
      console.error("Error retrieving DNS records:");
      return;
    }

    const records = listResponse.data.records;

    // Step 2: Find records matching the specified parameters
    const matchingRecords = records.filter(
      (record: DNSRecord) =>
        record.type === type &&
        record.name === name &&
        record.content === content,
    );

    if (matchingRecords.length === 0) {
      console.log("No matching DNS records found for deletion.");
      return;
    }

    // Step 3: Delete each matching record by its record_id
    for (const record of matchingRecords) {
      const deleteResponse = await axios.post(
        `${BASE_URL}/dns/delete/${domain}/${record.id}`,
        {
          apikey: apiKey,
          secretapikey: secretApiKey,
        },
      );

      if (deleteResponse.data.status === "SUCCESS") {
        console.log(`Successfully deleted DNS record with ID: ${record.id}`);
      } else {
        console.error(
          `Error deleting DNS record with ID: ${record.id}`,
          deleteResponse.data.message,
        );
      }
    }
  } catch (error) {
    console.error("Failed to delete DNS record(s):", error);
  }
}
