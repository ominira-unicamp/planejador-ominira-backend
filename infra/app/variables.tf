variable "project_id" {
  type = string
  description = "Google Cloud project ID"
}

variable region {
  type    = string
  description = "Google Cloud region to deploy resources"
  default = "us-east1"
}
variable app_name {
  type = string
  description = "Name of the Cloud Run service"
  default = "pomi-api"
}
variable db_instance_name {
  type = string
  description = "Name of the Cloud SQL instance"
  default = "pomi-db"
}
variable db_name {
  type = string
  description = "Name of the Postgres database"
  default = "pomi"
}
variable "db_user" {
  description = "Database user name"
  type = string
}
variable "db_password" {
  description = "Database user password"
  type = string
  sensitive = true
} 

variable "jwt_secret" {
  type = string
  sensitive = true
}

variable "custom_domain" {
  description = "Custom domain for the Cloud Run service"
  type        = string
  default     = "api.pomi.ominira.dev"
}