terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-southeast-2"
}

# 1. Khởi tạo VPC độc lập
resource "aws_vpc" "app_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "tracker-vpc"
    Environment = "Portfolio-DevSecOps"
  }
}

# 2. Internet Gateway cho phép VPC ra Internet
resource "aws_internet_gateway" "app_igw" {
  vpc_id = aws_vpc.app_vpc.id

  tags = {
    Name = "tracker-igw"
  }
}

# 3. Public Subnet
resource "aws_subnet" "app_public_subnet" {
  vpc_id                  = aws_vpc.app_vpc.id
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = true
  availability_zone       = "ap-southeast-2a"

  tags = {
    Name = "tracker-public-subnet"
  }
}

# 4. Route Table định tuyến ra Internet
resource "aws_route_table" "app_rt" {
  vpc_id = aws_vpc.app_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.app_igw.id
  }

  tags = {
    Name = "tracker-public-rt"
  }
}

resource "aws_route_table_association" "app_rta" {
  subnet_id      = aws_subnet.app_public_subnet.id
  route_table_id = aws_route_table.app_rt.id
}

# 5. Security Group (Mở cổng 80, 3000 cho Web và 22 cho SSH/EC2 Connect)
resource "aws_security_group" "app_sg" {
  name        = "tracker-web-sg"
  description = "Security group cho ung dung Web Tracker"
  vpc_id      = aws_vpc.app_vpc.id

  # Cho phép SSH / EC2 Instance Connect (Cổng 22)
  ingress {
    description = "SSH access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Cho phép người dùng truy cập web qua cổng 80
  ingress {
    description = "HTTP web access"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Cho phép truy cập cổng Next.js trực tiếp (cổng 3000)
  ingress {
    description = "Nextjs direct access"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Cho phép máy chủ gửi gói tin ra ngoài
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "tracker-sg"
  }
}

# 6. IAM Role & Instance Profile để cấp quyền tự động cho EC2 đọc ECR
resource "aws_iam_role" "ec2_ecr_role" {
  name = "tracker-ec2-ecr-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecr_readonly" {
  role       = aws_iam_role.ec2_ecr_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "tracker-ec2-instance-profile"
  role = aws_iam_role.ec2_ecr_role.name
}

# 7. Lấy AMI Ubuntu 22.04 LTS mới nhất
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical ID

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# 8. Máy chủ EC2 chạy ứng dụng (Free Tier)
resource "aws_instance" "app_server" {
  ami                  = data.aws_ami.ubuntu.id
  instance_type        = "t2.micro"
  subnet_id            = aws_subnet.app_public_subnet.id
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  iam_instance_profile = aws_iam_instance_profile.ec2_profile.name

  user_data = <<-EOF
              #!/bin/bash
              apt-get update -y
              apt-get install -y docker.io awscli
              systemctl start docker
              systemctl enable docker
              usermod -aG docker ubuntu
              EOF

  tags = {
    Name = "tracker-ec2-instance"
  }
}

# 9. In Public IP của máy chủ ra terminal
output "server_public_ip" {
  description = "Dia chi IP cong khai cua may chu EC2"
  value       = aws_instance.app_server.public_ip
}