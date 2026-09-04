{{/*
Chart name and full release name.
*/}}
{{- define "bayes-platform.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "bayes-platform.fullname" -}}
{{- if contains .Chart.Name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{/*
Name of a component: <fullname>-<component>.
Usage: {{ include "bayes-platform.componentName" (dict "root" . "component" "api") }}
*/}}
{{- define "bayes-platform.componentName" -}}
{{- printf "%s-%s" (include "bayes-platform.fullname" .root) .component | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels and selector labels.
*/}}
{{- define "bayes-platform.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/name: {{ include "bayes-platform.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Values.global.image.tag | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "bayes-platform.selectorLabels" -}}
app.kubernetes.io/name: {{ include "bayes-platform.name" .root }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/*
Full image reference for a component.
Usage: {{ include "bayes-platform.image" (dict "root" . "image" .Values.api.image) }}
*/}}
{{- define "bayes-platform.image" -}}
{{- printf "%s/%s:%s" .root.Values.global.image.registry .image .root.Values.global.image.tag -}}
{{- end -}}

{{- define "bayes-platform.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "bayes-platform.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/*
Name of the Secret that holds the application secrets.
*/}}
{{- define "bayes-platform.secretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- else -}}
{{- printf "%s-secrets" (include "bayes-platform.fullname" .) -}}
{{- end -}}
{{- end -}}

{{/*
Name of the Secret with the bundled Postgres password.
*/}}
{{- define "bayes-platform.postgresqlSecretName" -}}
{{- printf "%s-postgresql" (include "bayes-platform.fullname" .) -}}
{{- end -}}

{{/*
Database connection: host, port, name, user. Password is injected from a Secret.
*/}}
{{- define "bayes-platform.databaseHost" -}}
{{- if .Values.postgresql.enabled -}}
{{- include "bayes-platform.componentName" (dict "root" . "component" "postgresql") -}}
{{- else -}}
{{- required "externalDatabase.host is required when postgresql.enabled is false" .Values.externalDatabase.host -}}
{{- end -}}
{{- end -}}

{{- define "bayes-platform.databasePort" -}}
{{- if .Values.postgresql.enabled -}}5432{{- else -}}{{ .Values.externalDatabase.port }}{{- end -}}
{{- end -}}

{{- define "bayes-platform.databaseName" -}}
{{- if .Values.postgresql.enabled -}}{{ .Values.postgresql.auth.database }}{{- else -}}{{ .Values.externalDatabase.database }}{{- end -}}
{{- end -}}

{{- define "bayes-platform.databaseUser" -}}
{{- if .Values.postgresql.enabled -}}{{ .Values.postgresql.auth.username }}{{- else -}}{{ .Values.externalDatabase.username }}{{- end -}}
{{- end -}}

{{/*
Is the pdf-converter deployed? "auto" follows the storage mode.
*/}}
{{- define "bayes-platform.pdfConverterEnabled" -}}
{{- $enabled := .Values.pdfConverter.enabled -}}
{{- if kindIs "bool" $enabled -}}
{{- if $enabled -}}true{{- end -}}
{{- else if eq (toString $enabled) "auto" -}}
{{- if eq .Values.storage.mode "gcs" -}}true{{- end -}}
{{- else if eq (toString $enabled) "true" -}}true{{- end -}}
{{- end -}}

{{/*
Environment shared by the API, the workers and the migration job.
Non secret values come from the ConfigMap; here only the wiring that depends
on other chart values.
*/}}
{{- define "bayes-platform.sharedEnv" -}}
- name: NODE_ENV
  value: production
- name: DATABASE_HOST
  value: {{ include "bayes-platform.databaseHost" . | quote }}
- name: DATABASE_PORT
  value: {{ include "bayes-platform.databasePort" . | quote }}
- name: DATABASE_NAME
  value: {{ include "bayes-platform.databaseName" . | quote }}
- name: DATABASE_USERNAME
  value: {{ include "bayes-platform.databaseUser" . | quote }}
- name: DATABASE_PASSWORD
  valueFrom:
    secretKeyRef:
{{- if .Values.postgresql.enabled }}
      name: {{ include "bayes-platform.postgresqlSecretName" . }}
      key: password
{{- else }}
      name: {{ include "bayes-platform.secretName" . }}
      key: {{ .Values.externalDatabase.passwordKey }}
{{- end }}
{{- if .Values.redis.enabled }}
- name: BULLMQ_REDIS_URL
  value: {{ printf "redis://%s:6379" (include "bayes-platform.componentName" (dict "root" . "component" "redis")) | quote }}
{{- else }}
- name: BULLMQ_REDIS_URL
  valueFrom:
    secretKeyRef:
      name: {{ include "bayes-platform.secretName" . }}
      key: {{ .Values.externalRedis.urlKey }}
{{- end }}
- name: FRONTEND_URL
  value: {{ .Values.urls.web | quote }}
{{- if eq .Values.storage.mode "gcs" }}
- name: GCS_STORAGE_BUCKET_NAME
  value: {{ required "storage.gcs.bucket is required when storage.mode is gcs" .Values.storage.gcs.bucket | quote }}
{{- else }}
- name: LOCAL_STORAGE_SERVER_BASE_URL
  value: {{ .Values.urls.api | quote }}
{{- end }}
{{- if include "bayes-platform.pdfConverterEnabled" . }}
- name: PDF_CONVERTER_URL
  value: {{ printf "http://%s:%d" (include "bayes-platform.componentName" (dict "root" . "component" "pdf-converter")) (int .Values.pdfConverter.port) | quote }}
- name: PDF_CONVERTER_AUTH
  value: none
{{- end }}
{{- end -}}

{{/*
envFrom: the shared ConfigMap and the application Secret.
*/}}
{{- define "bayes-platform.sharedEnvFrom" -}}
- configMapRef:
    name: {{ include "bayes-platform.componentName" (dict "root" . "component" "config") }}
{{- if or .Values.secrets.existingSecret .Values.secrets.create }}
- secretRef:
    name: {{ include "bayes-platform.secretName" . }}
{{- end }}
{{- end -}}

{{/*
Volume and mount for the local file storage.
*/}}
{{- define "bayes-platform.storageVolume" -}}
{{- if eq .Values.storage.mode "local" }}
- name: documents
  persistentVolumeClaim:
    claimName: {{ include "bayes-platform.componentName" (dict "root" . "component" "documents") }}
{{- end }}
{{- end -}}

{{- define "bayes-platform.storageVolumeMount" -}}
{{- if eq .Values.storage.mode "local" }}
- name: documents
  mountPath: /app/dontsave_documents
{{- end }}
{{- end -}}

{{/*
Init container that waits for Postgres to accept connections.
*/}}
{{- define "bayes-platform.waitForDatabase" -}}
- name: wait-for-database
  image: busybox:1.37
  command:
    - sh
    - -c
    - |
      until nc -z {{ include "bayes-platform.databaseHost" . }} {{ include "bayes-platform.databasePort" . }}; do
        echo "waiting for the database"; sleep 2
      done
{{- end -}}

{{/*
Ingress host from a URL: strip the scheme and any path.
*/}}
{{- define "bayes-platform.host" -}}
{{- . | trimPrefix "https://" | trimPrefix "http://" | splitList "/" | first -}}
{{- end -}}
