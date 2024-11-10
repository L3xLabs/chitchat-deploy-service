terraform {
  required_providers {
    vultr = {
      source  = "vultr/vultr"
      version = "~> 2.0"
    }
  }
  required_version = ">= 1.2.0"
}

provider "vultr" {
  api_key     = "Z25OTJSA3XDGE5JP3KMVCDPK6N5MKNYJL7QA"
  rate_limit  = 700
  retry_limit = 3
}

resource "vultr_ssh_key" "deployer" {
  name    = "deployer-key"
  ssh_key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFOXGptTOfCPNMB8e4IHhIN95UHCm5APj8IcwKXY9RVj mayurpachpor@Mayurs-MacBook-Air.local"
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
