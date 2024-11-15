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
  sshKey: string;
  grafanaUserName: string;
  grafanaPassword: string;
  sshKeyPath: string;

  constructor(
    baseDomain: string,
    accessKeyId: string,
    secretAccessKey: string,
    provider: Providers,
    sshKey: string,
    grafanaUserName: string,
    grafanaPassword: string,
  ) {
    this.baseDomain = baseDomain;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.provider = provider;
    this.sshKey = sshKey;
    this.grafanaUserName = grafanaUserName;
    this.grafanaPassword = grafanaPassword;
    fs.writeFileSync(`./keys/ssh_key`, sshKey);
    this.sshKeyPath = `./keys/ssh_key`;
  }

  async setupTerraform() {
    const terraformCode =
      this.provider === Providers.AWS
        ? `terraform {
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
  public_key = "${this.sshKey}"
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

output "instance_ip" {
  value = aws_instance.ec2_example.public_ip
}
`
        : `terraform {
  required_providers {
    vultr = {
      source  = "vultr/vultr"
      version = "~> 2.0"
    }
  }
  required_version = ">= 1.2.0"
}

provider "vultr" {
  api_key     = "${this.accessKeyId}"
  rate_limit  = 700
  retry_limit = 3
}

resource "vultr_ssh_key" "deployer" {
  name    = "deployer-key"
  ssh_key = "${this.sshKey}"
}

resource "vultr_firewall_group" "allow_ssh_http_https" {
  description = "Allow SSH, HTTP, and HTTPS"
}

resource "vultr_firewall_rule" "allow_ssh" {
  firewall_group_id = vultr_firewall_group.allow_ssh_http_https.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "22"
  notes             = "Allow SSH"
}

resource "vultr_firewall_rule" "allow_http" {
  firewall_group_id = vultr_firewall_group.allow_ssh_http_https.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "80"
  notes             = "Allow HTTP"
}

resource "vultr_firewall_rule" "allow_https" {
  firewall_group_id = vultr_firewall_group.allow_ssh_http_https.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "443"
  notes             = "Allow HTTPS"
}

resource "vultr_instance" "server" {
  plan              = "vc2-1c-1gb"
  region            = "bom"
  os_id             = 1743
  hostname          = "ChitChat-Server"
  label             = "ChitChat-Server"
  firewall_group_id = vultr_firewall_group.allow_ssh_http_https.id
  ssh_key_ids       = [vultr_ssh_key.deployer.id]
}

output "instance_ip" {
  value = vultr_instance.server.main_ip
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
    fs.mkdirSync(`./infra/${this.accessKeyId}_playbook`, { recursive: true });

    fs.cpSync("./basePlaybook", `./infra/${this.accessKeyId}_playbook`, {
      recursive: true,
    });

    const inventoryContent = `[matrix_servers]
matrix.${this.baseDomain} ansible_host=${instanceIP} ansible_user=root ansible_ssh_private_key_file=${this.sshKeyPath}`;

    fs.writeFileSync(
      `./infra/${this.accessKeyId}_playbook/inventory/hosts`,
      inventoryContent,
    );

    const varsContent = `
---
matrix_domain: ${this.baseDomain}

matrix_homeserver_implementation: synapse

matrix_homeserver_generic_secret_key: "kwF9KZOu8Hqv6xMC8FjoMKfRLJPVegHfsYff2w8WVrM8SOwOsUTHMcYkYiqyvGQv"

matrix_playbook_reverse_proxy_type: playbook-managed-traefik

traefik_config_certificatesResolvers_acme_email: "admin@${this.baseDomain}"

postgres_connection_password: "ovwtlpnYrCmczpzNLTGA9u54tbkjiabbS0P4YajP2DqfUzL1Vqar0N9mi8NHa4it"

matrix_static_files_container_labels_base_domain_enabled: true

prometheus_enabled: true

prometheus_node_exporter_enabled: true

prometheus_postgres_exporter_enabled: true

matrix_prometheus_nginxlog_exporter_enabled: true

grafana_enabled: true

grafana_anonymous_access: false

grafana_default_admin_user: "${this.grafanaUserName}"

grafana_default_admin_password: "${this.grafanaPassword}"
# #Identity Server
matrix_ma1sd_enabled: true

matrix_synapse_enable_registration: true
matrix_synapse_enable_registration_captcha: true
matrix_synapse_recaptcha_public_key: "6Le_XGUqAAAAAGGkZj-eUU6cFbQPG8CMs4ofCch3"
matrix_synapse_recaptcha_private_key: "6Le_XGUqAAAAACupk1qMYHw4bMSvRcuJ6A4gS-eA"
matrix_coturn_enabled: true
matrix_coturn_turn_external_ip_address:

jitsi_enabled: true

matrix_admin: "@admin:{{ matrix_domain }}"

#Whatsapp bridge
matrix_mautrix_whatsapp_enabled: true
matrix_mautrix_whatsapp_bridge_relay_enabled: true
matrix_mautrix_whatsapp_bridge_relay_admin_only: false
matrix_appservice_double_puppet_enabled: true

matrix_synapse_workers_enabled: true
matrix_synapse_workers_preset: specialized-workers
`;
    fs.mkdirSync(
      `./infra/${this.accessKeyId}_playbook/inventory/host_vars/matrix.${this.baseDomain}`,
    );
    fs.writeFileSync(
      `./infra/${this.accessKeyId}_playbook/inventory/host_vars/matrix.${this.baseDomain}/vars.yml`,
      varsContent,
    );

    response.write("Ansible inventory configured \n");
    return;
  }

  async uploadAndRemoveConfig() {
    console.log("uploading terraform folder and removing it from memory");
  }

  async setupServices(response: Response) {
    new Promise<void>((resolve, reject) => {
      const ansibleProcess = spawn(
        "ansible-playbook",
        ["-i", "inventory/hosts", "setup.yml", "--tags=setup-all", "-vv"],
        {
          cwd: `./infra/${this.accessKeyId}_playbook`,
          shell: true,
          stdio: ["inherit", "pipe", "pipe"],
        },
      );

      let outputBuffer = "";

      ansibleProcess.stdout.on("data", (data) => {
        const output = data.toString();
        outputBuffer += output;
        response.write(output);
      });

      ansibleProcess.stderr.on("data", (data) => {
        const errorOutput = data.toString();
        outputBuffer += errorOutput;
        response.write(`ERROR: ${errorOutput}`);
      });

      ansibleProcess.on("close", (code) => {
        if (code === 0) {
          response.write(`Setting up ChitChat finished successfully\n`);
          resolve();
        } else {
          const errorMessage = `Ansible playbook execution failed with code ${code}\n${outputBuffer}`;
          response.write(errorMessage);
          reject(new Error(errorMessage));
        }
      });

      ansibleProcess.on("error", (error) => {
        const errorMessage = `Failed to start Ansible process: ${error.message}`;
        response.write(errorMessage);
        reject(new Error(errorMessage));
      });
    });
  }

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

    if (this.provider === Providers.VULTUR) {
      await this.configureAnsibleInventory(instanceIP, response);
      await this.setupServices(response);
      this.uploadAndRemoveConfig();
    } else {
      // await this.setupInfra(response);
      this.uploadAndRemoveConfig();
    }
  }
}
