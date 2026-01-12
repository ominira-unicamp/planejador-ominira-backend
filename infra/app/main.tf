provider "google" {
  project     = var.project_id
  region      = var.region
}

# Data sources to reference resources created in tofu-account
data "google_sql_database_instance" "instance" {
  name = var.db_instance_name
}

# Only manage Cloud Run service
resource "google_cloud_run_v2_service" "api" {
  name     = var.app_name
  location = var.region
  deletion_protection = true
  
  template {
    health_check_disabled = true

    containers {
	  image = var.container_image
	  
      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

	  ports {
        container_port = 3000
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "DATABASE_URL"
        value = "postgresql://${var.db_user}:${var.db_password}@${data.google_sql_database_instance.instance.public_ip_address}:5432/${var.db_name}?schema=public"
      }

      env {
        name  = "secretKey"
        value = var.jwt_secret
      }
      
      startup_probe {
        initial_delay_seconds = 0
        timeout_seconds       = 120
        period_seconds        = 10
        failure_threshold     = 8
        tcp_socket {
          port = 3000
        }
      }
    }
  }
  
  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

resource "google_cloud_run_service_iam_member" "public_access" {
  location = google_cloud_run_v2_service.api.location
  service  = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_domain_mapping" "api_pomi" {
  location = var.region
  name     = var.custom_domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.api.name
  }

  depends_on = [google_cloud_run_v2_service.api]
}
