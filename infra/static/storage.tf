# GCS bucket for Terraform remote state
resource "google_storage_bucket" "terraform_state" {
  name          = "${var.project_id}-tfstate"
  location      = var.region
  force_destroy = false

  versioning {
    enabled = true
  }

  uniform_bucket_level_access = true

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      num_newer_versions = 5
    }
  }
}

# Grant service account access to the state bucket
resource "google_storage_bucket_iam_member" "state_admin" {
  bucket = google_storage_bucket.terraform_state.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.tofu_github.email}"
}
