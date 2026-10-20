import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 when different from gemini 3.x => set only temp
 when gemini 3.x =>
    - 'gemini-3.1-flash-lite' and 'gemini-3.5-flash' => set temp + thinking level (temp is NOT deprecated for these models)
      temp is set to 1: the stored temperature was never sent to a 3.x model, which ran on Google's default of 1
    - others => set only thinking level

     table for approximative and arbitrary conversion from temp to thinking level:
     DEFAULT : temp = 0, the studio's default, kept by agents that never chose one:
               the model's official default level (minimal for flash-lite, medium for flash),
               the level these agents ran on until now
     MINIMAL : 0 < temp <= 0.3 (*)
     LOW : 0.3 < temp <= 0.7
     MEDIUM : 0.7 < temp <= 1.3
     HIGH : 1.3 < temp <= 2.0

    (*) : if MINIMAL not available for model => LOW
 */
export class SetAgentSettingsProviderOptionsFromTemperature1791703856140
  implements MigrationInterface
{
  name = "SetAgentSettingsProviderOptionsFromTemperature1791703856140"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "agent_settings"
      SET "provider_options" = CASE
        WHEN "agent_settings"."model" IN ('gemini-3.1-flash-lite', 'gemini-3.5-flash')
          THEN jsonb_build_object(
            'temperature', 1,
            'providerOptions', derived.vertex_options
          )
        WHEN "agent_settings"."model" IN (
          'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.8-flash'
        )
          THEN jsonb_build_object('providerOptions', derived.vertex_options)
        ELSE jsonb_build_object('temperature', "agent_settings"."temperature"::float8)
      END
      FROM (
        SELECT
          settings.id,
          jsonb_build_object(
            'vertex', jsonb_build_object(
              'thinkingConfig', jsonb_build_object(
                'thinkingLevel', CASE
                  WHEN settings.temperature = 0 THEN
                    CASE
                      WHEN settings.model IN ('gemini-3.1-flash-lite', 'gemini-3.5-flash-lite')
                        THEN 'minimal'
                      ELSE 'medium'
                    END
                  WHEN settings.temperature <= 0.3 THEN
                    CASE
                      WHEN settings.model IN ('gemini-3.7-flash', 'gemini-3.8-flash') THEN 'low'
                      ELSE 'minimal'
                    END
                  WHEN settings.temperature <= 0.7 THEN 'low'
                  WHEN settings.temperature <= 1.3 THEN 'medium'
                  ELSE 'high'
                END,
                'includeThoughts', true
              )
            )
          ) AS vertex_options
        FROM "agent_settings" settings
        WHERE settings.provider_options IS NULL
      ) derived
      WHERE "agent_settings".id = derived.id
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "agent_settings" SET "provider_options" = NULL`)
  }
}
