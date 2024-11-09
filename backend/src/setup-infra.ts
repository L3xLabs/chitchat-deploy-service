import { spawn } from "child_process";
import fs from "fs";
import { Response } from "express";
import { Providers } from ".";
import { createDNSRecord, DNSRecordParams } from "./dns-client/porkbun";

export class InfrastructureService {
  baseDomain: string;
  accessKeyId: string;
  secretAccessKey: string;
  provider: Providers;

  constructor(
    baseDomain: string,
    accessKeyId: string,
    secretAccessKey: string,
    provider: Providers,
  ) {
    this.baseDomain = baseDomain;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.provider = provider;
  }

  async setupTerraform() {
    const terraformCode = `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16"
    }
  }

  required_version = ">= 1.2.0"
}

provider "aws" {
  region     = "ap-south-1"
  access_key = "${this.accessKeyId}"                     
  secret_key = "${this.secretAccessKey}"
}

resource "aws_key_pair" "deployer" {
  key_name   = "deployer-key"
  public_key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFOXGptTOfCPNMB8e4IHhIN95UHCm5APj8IcwKXY9RVj mayurpachpor@Mayurs-MacBook-Air.local"
}

resource "aws_security_group" "allow_ssh_http_https" {
  name = "allow_ssh_http_https"

  ingress {
    description = "Allow SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "Allow-SSH-HTTP-HTTPS"
  }
}

resource "aws_instance" "ec2_example" {
  ami           = "ami-0dee22c13ea7a9a67"
  instance_type = "t2.micro"
  key_name      = aws_key_pair.deployer.key_name

  # Attach security group
  vpc_security_group_ids = [aws_security_group.allow_ssh_http_https.id]

  tags = {
    Name = "ChitChat-Server"
  }
}

resource "aws_s3_bucket" "example_bucket" {
  bucket = "${this.baseDomain}-bucket" 

  tags = {
    Name        = "S3-Bucket"
    Environment = "Dev"
  }
}

# resource "aws_route53_record" "dns_record" {
#   zone_id = "<ROUTE53_ZONE_ID>"
#   name    = "${this.baseDomain}"
#   type    = "A"
#   ttl     = "300"
#   records = [aws_instance.ec2_example.public_ip]
# }

output "instance_ip" {
  value = aws_instance.ec2_example.public_ip
}
`;
    fs.mkdirSync(`./infra/${this.accessKeyId}`);
    fs.writeFileSync(`./infra/${this.accessKeyId}/main.tf`, terraformCode);
  }

  async runTerraform(response: Response) {
    response.write("Setting up infra");
    return new Promise<void>((resolve, reject) => {
      const terraformProcess = spawn(
        "terraform",
        ["init", "&&", "terraform", "apply", "-auto-approve"],
        {
          cwd: `./infra/${this.accessKeyId}`,
          shell: true,
        },
      );

      terraformProcess.stdout.on("data", (data) => {
        response.write(data);
      });

      terraformProcess.stderr.on("data", (data) => {
        response.write(`ERROR: ${data}`);
      });

      terraformProcess.on("close", (code) => {
        response.write(
          `Infra Provisioning Process finished with code ${code} \n`,
        );
        resolve();
      });

      terraformProcess.on("error", (error) => {
        response.write(`ERROR: ${error.message}`);
        response.end();
        reject(error);
      });
    });
  }

  async getTerraformOutput(response: Response) {
    response.write("Retriving the ip of newly created machine \n");
    return new Promise<string>((resolve, reject) => {
      let output = "";

      const outputProcess = spawn("terraform", ["output", "-json"], {
        cwd: `./infra/${this.accessKeyId}`,
        shell: true,
      });

      outputProcess.stdout.on("data", (data) => {
        response.write(data); // Stream output data to client
        output = data;
      });

      outputProcess.stderr.on("data", (data) => {
        response.write(`ERROR: ${data}`);
      });

      outputProcess.on("close", (code) => {
        response.write(`Ip Retrival Process finished with code ${code} \n`);
        resolve(output);
      });

      outputProcess.on("error", (error) => {
        response.write(`ERROR: ${error.message}`);
        response.end();
        reject(error);
      });
    });
  }

  async createRecords(
    ip: string,
    dnsApiKey: string,
    dnsSecretApiKey: string,
    response: Response,
  ) {
    const recordOneData: DNSRecordParams = {
      domain: this.baseDomain,
      content: ip,
      name: "",
      type: "A",
      ttl: 600,
    };

    const recordTwoData: DNSRecordParams = {
      domain: this.baseDomain,
      content: ip,
      name: "matrix",
      type: "A",
      ttl: 600,
    };

    const recordThreeData: DNSRecordParams = {
      domain: this.baseDomain,
      content: `matrix.${this.baseDomain}`,
      name: "stats",
      type: "CNAME",
      ttl: 600,
    };

    const recordFourData: DNSRecordParams = {
      domain: this.baseDomain,
      content: `matrix.${this.baseDomain}`,
      name: "jitsi",
      type: "CNAME",
      ttl: 600,
    };

    const recordFiveData: DNSRecordParams = {
      domain: this.baseDomain,
      content: `matrix.${this.baseDomain}`,
      name: "element",
      type: "CNAME",
      ttl: 600,
    };

    const recordSixData: DNSRecordParams = {
      domain: this.baseDomain,
      content: `matrix.${this.baseDomain}`,
      name: "matrix",
      type: "MX",
      prio: 10,
      ttl: 600,
    };

    const recordSevenData: DNSRecordParams = {
      domain: this.baseDomain,
      content: `0 443 matrix.${this.baseDomain}`,
      name: "_matrix-identity._tcp",
      type: "SRV",
      prio: 10,
      ttl: 600,
    };

    const recordEaightData: DNSRecordParams = {
      domain: this.baseDomain,
      content: `v=spf1 ip4:${ip} -all`,
      name: "matrix",
      type: "TXT",
      ttl: 600,
    };

    response.write("Creating DNS Records \n");

    const resOne = await createDNSRecord(
      recordOneData,
      dnsApiKey,
      dnsSecretApiKey,
    );

    if (resOne.ok) {
      response.write(`${resOne.msg} \n`);
    } else {
      response.write(`${resOne.msg} \n`);
      response.end();
      return;
    }

    const resTwo = await createDNSRecord(
      recordTwoData,
      dnsApiKey,
      dnsSecretApiKey,
    );

    if (resTwo.ok) {
      response.write(`${resTwo.msg} \n`);
    } else {
      response.write(`${resTwo.msg} \n`);
      response.end();
      return;
    }

    const resThree = await createDNSRecord(
      recordThreeData,
      dnsApiKey,
      dnsSecretApiKey,
    );

    if (resThree.ok) {
      response.write(`${resThree.msg} \n`);
    } else {
      response.write(`${resThree.msg} \n`);
      response.end();
      return;
    }
    const resFour = await createDNSRecord(
      recordFourData,
      dnsApiKey,
      dnsSecretApiKey,
    );

    if (resFour.ok) {
      response.write(`${resFour.msg} \n`);
    } else {
      response.write(`${resFour.msg} \n`);
      response.end();
      return;
    }
    const resFive = await createDNSRecord(
      recordFiveData,
      dnsApiKey,
      dnsSecretApiKey,
    );

    if (resFive.ok) {
      response.write(`${resFive.msg} \n`);
    } else {
      response.write(`${resFive.msg} \n`);
      response.end();
      return;
    }
    const resSix = await createDNSRecord(
      recordSixData,
      dnsApiKey,
      dnsSecretApiKey,
    );

    if (resSix.ok) {
      response.write(`${resSix.msg} \n`);
    } else {
      response.write(`${resSix.msg} \n`);
      response.end();
      return;
    }
    const resSeven = await createDNSRecord(
      recordSevenData,
      dnsApiKey,
      dnsSecretApiKey,
    );

    if (resSeven.ok) {
      response.write(`${resSeven.msg} \n`);
    } else {
      response.write(`${resSeven.msg} \n`);
      response.end();
      return;
    }
    const resEaight = await createDNSRecord(
      recordEaightData,
      dnsApiKey,
      dnsSecretApiKey,
    );

    if (resEaight.ok) {
      response.write(`${resEaight.msg} \n`);
    } else {
      response.write(`${resEaight.msg} \n`);
      response.end();
      return;
    }

    response.write("All DNS Records Created! \n");
    return;
  }

  async configureAnsibleInventory(instanceIP: string, response: Response) {
    fs.mkdirSync(`./infra/${this.accessKeyId}_playbook`);
    fs.cpSync("./basePlaybook", `./infra/${this.accessKeyId}_playbook`, {
      recursive: true,
    });

    const inventoryContent = `[matrix_servers]
matrix.${this.baseDomain} ansible_host=${instanceIP} ${this.provider === Providers.AWS ? "ansible_ssh_user=ubuntu" : "ansible_ssh_user=root"}`;
    fs.writeFileSync(
      `./infra/${this.accessKeyId}_playbook/inventory/hosts`,
      inventoryContent,
    );

    response.end("Ansible inventory configured \n"); //Change this to response.write()
    return;
  }

  async uploadAndRemoveConfig() {
    console.log("uploading terraform folder and removing it from memory");
  }
  // async runAnsiblePlaybook() {
  //   return new Promise((resolve, reject) => {
  //     exec(
  //       `ansible-playbook -i ${this.inventoryPath} ${this.playbookPath}`,
  //       (error, stdout, stderr) => {
  //         if (error) {
  //           console.error(`Ansible Playbook Error: ${error.message}`);
  //           return reject(error);
  //         }
  //         console.log(`Ansible Output: ${stdout}`);
  //         if (stderr) console.error(`Ansible Stderr: ${stderr}`);
  //         resolve(stdout);
  //       },
  //     );
  //   });
  // }

  async setupInfrastructure(
    response: Response,
    dnsApiKey: string,
    dnsSecretApiKey: string,
  ) {
    await this.setupTerraform();
    await this.runTerraform(response);
    const terraformOutput = await this.getTerraformOutput(response);
    const instanceIP = JSON.parse(terraformOutput).instance_ip.value;
    await this.createRecords(instanceIP, dnsApiKey, dnsSecretApiKey, response);
    await this.configureAnsibleInventory(instanceIP, response);
    this.uploadAndRemoveConfig();
    // await this.runAnsiblePlaybook();
  }
}
