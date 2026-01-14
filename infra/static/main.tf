provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_project_service" "resource_manager" {
  service            = "cloudresourcemanager.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "artifact_registry" {
  service            = "artifactregistry.googleapis.com"
  disable_on_destroy = false
  depends_on         = [google_project_service.resource_manager]
}

resource "google_project_service" "cloud_run" {
  service            = "run.googleapis.com"
  disable_on_destroy = false
  depends_on         = [google_project_service.resource_manager]
}

resource "google_project_service" "cloud_sql" {
  service            = "sqladmin.googleapis.com"
  disable_on_destroy = false
  depends_on         = [google_project_service.resource_manager]
}

resource "google_project_service" "vpcaccess" {
  service            = "vpcaccess.googleapis.com"
  disable_on_destroy = false
  depends_on         = [google_project_service.resource_manager]
}

resource "google_project_service" "compute" {
  service            = "compute.googleapis.com"
  disable_on_destroy = false
  depends_on         = [google_project_service.resource_manager]
}
