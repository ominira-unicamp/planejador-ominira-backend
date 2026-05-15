# Cloud SQL instance for Keycloak
resource "google_sql_database_instance" "keycloak" {
  name             = var.keycloak_db_instance_name
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier = "db-f1-micro"

    ip_configuration {
      ipv4_enabled = true
      authorized_networks {
        name  = "all"
        value = "0.0.0.0/0"
      }
    }

    backup_configuration {
      enabled = true
      start_time = "03:00"
    }
  }

  deletion_protection = true

  depends_on = [google_project_service.cloud_sql]
}

resource "google_sql_database" "keycloak" {
  name     = "keycloak"
  instance = google_sql_database_instance.keycloak.name
}

resource "google_sql_user" "keycloak" {
  name     = var.keycloak_db_user
  instance = google_sql_database_instance.keycloak.name
  password = var.keycloak_db_password
}

# Cloud Run service for Keycloak
resource "google_cloud_run_v2_service" "keycloak" {
  name     = "keycloak"
  location = var.region
  deletion_protection = true

  template {
    scaling {
      min_instance_count = 1
      max_instance_count = 2
    }

    containers {
      image = "docker.io/keycloak/keycloak:24.0"

      args = ["start"]

      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
      }

      ports {
        container_port = 8080
      }

      # Database configuration
      env {
        name  = "KC_DB"
        value = "postgres"
      }

      env {
        name  = "KC_DB_URL"
        value = "jdbc:postgresql://${google_sql_database_instance.keycloak.public_ip_address}:5432/keycloak"
      }

      env {
        name  = "KC_DB_USERNAME"
        value = var.keycloak_db_user
      }

      env {
        name  = "KC_DB_PASSWORD"
        value = var.keycloak_db_password
      }

      # Hostname configuration - using Cloud Run URL
      env {
        name  = "KC_HOSTNAME_STRICT"
        value = "false"
      }

      env {
        name  = "KC_HOSTNAME_STRICT_HTTPS"
        value = "false"
      }

      env {
        name  = "KC_PROXY_HEADERS"
        value = "xforwarded"
      }

      env {
        name  = "KC_HTTP_ENABLED"
        value = "true"
      }

      # Admin credentials
      env {
        name  = "KEYCLOAK_ADMIN"
        value = var.keycloak_admin_user
      }

      env {
        name  = "KEYCLOAK_ADMIN_PASSWORD"
        value = var.keycloak_admin_password
      }

      # Monitoring
      env {
        name  = "KC_METRICS_ENABLED"
        value = "true"
      }

      env {
        name  = "KC_HEALTH_ENABLED"
        value = "true"
      }

      env {
        name  = "KC_LOG_LEVEL"
        value = "info"
      }

      startup_probe {
        initial_delay_seconds = 30
        timeout_seconds       = 10
        period_seconds        = 15
        failure_threshold     = 10
        http_get {
          path = "/health/ready"
          port = 8080
        }
      }

      liveness_probe {
        initial_delay_seconds = 60
        timeout_seconds       = 10
        period_seconds        = 30
        failure_threshold     = 3
        http_get {
          path = "/health/live"
          port = 8080
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [google_sql_database_instance.keycloak, google_sql_database.keycloak, google_sql_user.keycloak]
}

# Make Keycloak publicly accessible
resource "google_cloud_run_service_iam_member" "keycloak_public_access" {
  location = google_cloud_run_v2_service.keycloak.location
  service  = google_cloud_run_v2_service.keycloak.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
