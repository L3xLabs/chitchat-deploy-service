# Setting up Mautrix wsproxy (optional)

The playbook can install and configure [mautrix-wsproxy](https://github.com/mautrix/wsproxy) for you.

See the project's [documentation](https://github.com/mautrix/wsproxy#readme) to learn what it does and why it might be useful to you.


## DNS

You need to create a `wsproxy.DOMAIN` DNS record pointing to your Matrix server (a `CNAME` pointing to `matrix.DOMAIN`) to use wsproxy.
The hostname is configurable via a `matrix_mautrix_wsproxy_hostname` variable.

## Adjusting the playbook configuration

To enable the bridge, add the following configuration to your `inventory/host_vars/matrix.DOMAIN/vars.yml` file:

```yaml
matrix_mautrix_wsproxy_enabled: true

matrix_mautrix_androidsms_appservice_token: 'secret token from bridge'
matrix_mautrix_androidsms_homeserver_token: 'secret token from bridge'
matrix_mautrix_imessage_appservice_token: 'secret token from bridge'
matrix_mautrix_imessage_homeserver_token: 'secret token from bridge'
matrix_mautrix_wsproxy_syncproxy_shared_secret: 'secret token from bridge'
```

Note that the tokens must match what is compiled into the [mautrix-imessage](https://github.com/mautrix/imessage) bridge running on your Mac or Android device.

## Installing

After configuring the playbook, run the [installation](installing.md) command: `just install-all` or `just setup-all`

## Usage

Follow the [matrix-imessage documenation](https://docs.mau.fi/bridges/go/imessage/index.html) for running `android-sms` and/or `matrix-imessage` on your device(s).
