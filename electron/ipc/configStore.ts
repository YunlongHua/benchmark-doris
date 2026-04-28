import { app } from '../shims'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join, resolve } from 'path'
import yaml from 'js-yaml'
import { ClusterConfig } from '../../src/types'

export class ConfigStore {
  private configDir: string

  constructor() {
    this.configDir = resolve(app.getPath('userData'), 'data', 'clusters')
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true })
    }
  }

  list(): ClusterConfig[] {
    try {
      const files = readdirSync(this.configDir).filter(f => f.endsWith('.yaml'))
      return files.map(file => {
        const content = readFileSync(join(this.configDir, file), 'utf-8')
        return yaml.load(content) as ClusterConfig
      })
    } catch {
      return []
    }
  }

  get(name: string): ClusterConfig | null {
    const filePath = join(this.configDir, `${name}.yaml`)
    if (!existsSync(filePath)) return null
    const content = readFileSync(filePath, 'utf-8')
    return yaml.load(content) as ClusterConfig
  }

  save(config: ClusterConfig): void {
    const filePath = join(this.configDir, `${config.name}.yaml`)
    writeFileSync(filePath, yaml.dump(config), 'utf-8')
  }

  delete(name: string): void {
    const filePath = join(this.configDir, `${name}.yaml`)
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }
  }
}