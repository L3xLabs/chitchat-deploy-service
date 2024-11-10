import axios from "axios";
import { Response } from "express";
import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";

export async function setupVultrObjectStorageAndBucket(
  apiKey: string,
  label: string,
  response: Response,
) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  try {
    response.write("Creating Vultr Object Storage...\n");

    const createResponse = await axios.post(
      "https://api.vultr.com/v2/object-storage",
      {
        cluster_id: 2,
        label: label,
      },
      { headers },
    );

    const objectStorageId = createResponse.data.object_storage.id;
    response.write("Waiting for Object Storage to be ready...\n");

    let status = "pending";
    while (status !== "active") {
      const statusResponse = await axios.get(
        `https://api.vultr.com/v2/object-storage/${objectStorageId}`,
        { headers },
      );
      status = statusResponse.data.object_storage.status;
      if (status === "active") break;
      await new Promise((resolve) => setTimeout(resolve, 5000));
      response.write("Still waiting for Object Storage to be ready...\n");
    }

    response.write("Getting Object Storage details...\n");
    const storageResponse = await axios.get(
      `https://api.vultr.com/v2/object-storage/${objectStorageId}`,
      { headers },
    );

    const storageDetails = storageResponse.data.object_storage;
    const bucketName = "synapse-media";

    await new Promise((resolve) => setTimeout(resolve, 10000));

    response.write("Creating S3 client and bucket...\n");
    const s3Client = new S3Client({
      endpoint: `https://${storageDetails.s3_hostname}`,
      credentials: {
        accessKeyId: storageDetails.s3_access_key,
        secretAccessKey: storageDetails.s3_secret_key,
      },
      forcePathStyle: true,
    });

    try {
      const createBucketCommand = new CreateBucketCommand({
        Bucket: bucketName,
      });

      await s3Client.send(createBucketCommand);
      response.write(`Successfully created bucket: ${bucketName}\n`);
    } catch (error) {
      //@ts-ignore
      response.write(`Error creating bucket: ${error.message}\n`);
      throw error;
    }

    const result = {
      region: storageDetails.region,
      s3_hostname: storageDetails.s3_hostname,
      access_key: storageDetails.s3_access_key,
      secret_key: storageDetails.s3_secret_key,
    };

    response.write("Storage and bucket setup completed successfully!\n");
    return result;
  } catch (error) {
    //@ts-ignore
    const errorMessage = `Failed to setup Vultr object storage and bucket: ${error.message}`;
    response.write(`ERROR: ${errorMessage}\n`);
    throw new Error(errorMessage);
  }
}
