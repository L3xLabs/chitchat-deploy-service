import express, { Application, Request, Response } from "express";
import cors from "cors";
import asyncHandler from "express-async-handler";
import { InfrastructureService } from "./setup-infra";

export enum Providers {
  "AWS" = "AWS",
  "VULTUR" = "VULTUR",
}

const PORT = 8000;
const app: Application = express();

app.use(cors());
app.use(express.json());

app.post(
  "/api/setup",
  asyncHandler(async (req: Request, res: Response) => {
    const {
      domain,
      accessKeyId,
      secretAccessKey,
      provider,
      dnsApiKey,
      dnsSecretApiKey,
    } = req.body;

    const service = new InfrastructureService(
      domain,
      accessKeyId,
      secretAccessKey,
      provider,
    );

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");

    try {
      await service.setupInfrastructure(res, dnsApiKey, dnsSecretApiKey);
      return;
    } catch (error) {
      res.status(500).json({ msg: "Error in setup", error: error });
      return;
    }
  }),
);

app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
});
