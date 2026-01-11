# Cloud SQL Infrastructure
resource "google_sql_database_instance" "instance" {
  name                = var.db_instance_name
  database_version    = "POSTGRES_15"
  deletion_protection = false

  settings {
    tier = "db-f1-micro"

    disk_type = "PD_HDD"
    disk_size = 10

    insights_config {
      query_insights_enabled = false
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = false 
      start_time                     = "03:00"
      transaction_log_retention_days = 1 
      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled = true
      authorized_networks {
        name  = "all"
        value = "0.0.0.0/0"
      }
    }
  }
  depends_on = [google_project_service.cloud_sql]
}

resource "google_sql_user" "users" {
  name     = var.db_user
  instance = google_sql_database_instance.instance.name
  password = var.db_password
}

resource "google_sql_database" "database" {
  name     = var.db_name
  instance = google_sql_database_instance.instance.name
}
