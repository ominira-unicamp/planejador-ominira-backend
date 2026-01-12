# Cloud SQL Infrastructure
resource "google_sql_database_instance" "instance" {
  name                = var.db_instance_name
  database_version    = "POSTGRES_15"
  deletion_protection = false

  settings {
    tier = "db-g1-small"

    disk_type       = "PD_SSD"
    disk_size       = 50
    disk_autoresize = true
    disk_autoresize_limit = 100

    insights_config {
      query_insights_enabled = true
      query_plans_per_minute = 5
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
  depends_on = [
    google_project_service.cloud_sql,
    google_compute_global_address.sql_static_ip
  ]
}

resource "google_sql_user" "users" {
  name     = var.db_user
  instance = google_sql_database_instance.instance.name
  password = var.db_password

  depends_on = [ google_sql_database_instance.instance ]
}

resource "google_sql_database" "database" {
  name     = var.db_name
  instance = google_sql_database_instance.instance.name
  depends_on = [ google_sql_database_instance.instance ]
}
