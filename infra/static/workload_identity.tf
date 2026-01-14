resource "google_service_account" "tofu_github" {
  account_id   = "tofu-github"
  display_name = "Tofu GitHub Actions SA"
}

resource "google_iam_workload_identity_pool" "pool" {
  workload_identity_pool_id = "pomi-gh-pool"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.pool.workload_identity_pool_id
  workload_identity_pool_provider_id = "pomi-gh-prvdr"
  display_name                       = "GitHub Actions Provider"
  description                        = "GitHub Actions identity pool provider for automated test"
  disabled                           = false
  attribute_condition = <<EOT
    assertion.repository_owner_id == "${var.repository_owner_id}" &&
    attribute.repository == "ominira-unicamp/pomi-backend"
EOT
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.aud"        = "assertion.aud"
    "attribute.repository" = "assertion.repository"
  }
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_account_iam" {
  service_account_id = google_service_account.tofu_github.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.pool.name}/attribute.repository/ominira-unicamp/pomi-backend"
}
