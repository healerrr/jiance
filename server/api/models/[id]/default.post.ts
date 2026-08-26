import { publicModelConfig, setDefaultModel } from '../../../utils/model-configs'

export default defineEventHandler(async (event) => {
  return publicModelConfig(await setDefaultModel(getRouterParam(event, 'id')!))
})
