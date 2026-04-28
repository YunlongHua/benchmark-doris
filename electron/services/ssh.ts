import { Client, ConnectConfig } from 'ssh2'

export class SSHService {
  private client: Client | null = null

  async testConnection(config: ConnectConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new Client()
      
      const timeout = setTimeout(() => {
        client.end()
        reject(new Error('Connection timeout'))
      }, 10000)

      client.on('ready', () => {
        clearTimeout(timeout)
        client.end()
        resolve()
      })

      client.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })

      client.connect(config)
    })
  }

  async executeCommand(config: ConnectConfig, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = new Client()
      
      const timeout = setTimeout(() => {
        client.end()
        reject(new Error('Connection timeout'))
      }, 60000)

      client.on('ready', () => {
        client.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timeout)
            client.end()
            reject(err)
            return
          }

          let stdout = ''
          let stderr = ''

          stream.on('close', (code: number) => {
            clearTimeout(timeout)
            client.end()
            if (code !== 0 && stderr) {
              reject(new Error(stderr || `Command exited with code ${code}`))
            } else {
              resolve(stdout)
            }
          })

          stream.on('data', (data: Buffer) => {
            stdout += data.toString()
          })

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString()
          })
        })
      })

      client.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })

      client.connect(config)
    })
  }

  async executeCommandWithOutput(
    config: ConnectConfig, 
    command: string, 
    onData: (data: string) => void
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const client = new Client()
      
      const timeout = setTimeout(() => {
        client.end()
        reject(new Error('Connection timeout'))
      }, 60000)

      client.on('ready', () => {
        client.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timeout)
            client.end()
            reject(err)
            return
          }

          let stderr = ''

          stream.on('close', (code: number) => {
            clearTimeout(timeout)
            client.end()
            if (code !== 0 && stderr) {
              reject(new Error(stderr || `Command exited with code ${code}`))
            } else {
              resolve(code || 0)
            }
          })

          stream.on('data', (data: Buffer) => {
            const str = data.toString()
            onData(str)
          })

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString()
          })
        })
      })

      client.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })

      client.connect(config)
    })
  }
}

export const sshService = new SSHService()