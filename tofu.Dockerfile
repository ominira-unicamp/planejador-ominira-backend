FROM ghcr.io/opentofu/opentofu:minimal AS tofu


FROM alpine
COPY --from=tofu /usr/local/bin/tofu /usr/local/bin/tofu

ADD https://dl.google.com/dl/cloudsdk/release/google-cloud-sdk.tar.gz /tmp/google-cloud-sdk.tar.gz
RUN apk add --no-cache python3 py3-pip

RUN mkdir -p /usr/local/gcloud \
  && tar -C /usr/local/gcloud -xvf /tmp/google-cloud-sdk.tar.gz \
  && /usr/local/gcloud/google-cloud-sdk/install.sh \
  && rm /tmp/google-cloud-sdk.tar.gz

ENV PATH $PATH:/usr/local/gcloud/google-cloud-sdk/bin

ENTRYPOINT [ "/bin/sh" ]