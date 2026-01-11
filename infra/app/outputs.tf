output "cloud_run_url" {
  description = "URL of the Cloud Run service"
  value       = google_cloud_run_v2_service.api.uri
}

output "cloud_run_domain" {
  description = "Domínio do Cloud Run para CNAME (sem https://)"
  value       = replace(google_cloud_run_v2_service.api.uri, "https://", "")
}

output "cloud_run_name" {
  description = "Nome do serviço Cloud Run"
  value       = google_cloud_run_v2_service.api.name
}

output "cloud_run_location" {
  description = "Localização do serviço Cloud Run"
  value       = google_cloud_run_v2_service.api.location
}

output "custom_domain" {
  description = "Domínio customizado configurado"
  value       = google_cloud_run_domain_mapping.api_pomi.name
}

output "custom_domain_status" {
  description = "Status do domínio customizado"
  value       = google_cloud_run_domain_mapping.api_pomi.status
}
