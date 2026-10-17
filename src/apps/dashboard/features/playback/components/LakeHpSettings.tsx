import React, { type FC, useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import MenuItem from '@mui/material/MenuItem';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

/** The LakeHP fields of the server's encoding options. */
export interface LakeHpEncodingOptions {
    LakeHpFilterPath?: string | null;
    LakeHpRoom?: number | string;
    LakeHpSurroundAzimuth?: number | string;
    LakeHpRearAzimuth?: number | string;
    LakeHpMatrixMode?: string | null;
    LakeHpMatrixLfe?: boolean;
}

interface LakeHpStatus {
    HeadphonesAvailable: boolean;
    MatrixSurroundAvailable: boolean;
    FilterFound: boolean;
    FfmpegSupported: boolean;
    FilterPath?: string | null;
}

interface LakeHpSettingsProps {
    config: LakeHpEncodingOptions;
    onChange: (patch: LakeHpEncodingOptions) => void;
}

const PRESETS = {
    Factory: { surround: 118, rear: 118 },
    Theater: { surround: 136, rear: 150 }
} as const;

type Preset = keyof typeof PRESETS | 'Custom';

const MIN_ANGLE = 90;
const MAX_ANGLE = 165;

const toNumber = (value: number | string | undefined, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const presetFor = (surround: number, rear: number): Preset => {
    for (const [ name, p ] of Object.entries(PRESETS)) {
        if (p.surround === surround && p.rear === rear) return name as Preset;
    }
    return 'Custom';
};

/** Top view of the listener with the virtual speakers. */
const SpeakerDiagram: FC<{ surround: number, rear: number }> = ({ surround, rear }) => {
    const cx = 100, cy = 100, r = 70;
    const at = (deg: number) => {
        const a = deg * Math.PI / 180;
        return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
    };
    const dot = (deg: number, color: string, key: string) => {
        const p = at(deg);
        return <circle key={key} cx={p.x} cy={p.y} r={7} fill={color} />;
    };
    return (
        <svg viewBox='0 0 200 200' width={180} height={180} role='img' aria-label={globalize.translate('LabelLakeHpPreset')}>
            <circle cx={cx} cy={cy} r={r} fill='none' stroke='currentColor' strokeOpacity={0.2} strokeDasharray='3 4' />
            <circle cx={cx} cy={cy} r={16} fill='none' stroke='currentColor' strokeOpacity={0.7} strokeWidth={2} />
            <path d={`M ${cx - 5} ${cy - 15} L ${cx} ${cy - 23} L ${cx + 5} ${cy - 15}`} fill='none' stroke='currentColor' strokeOpacity={0.7} strokeWidth={2} />
            {[ -30, 0, 30 ].map(d => dot(d, '#00a4dc', `f${d}`))}
            {[ -surround, surround ].map(d => dot(d, '#4caf50', `s${d}`))}
            {surround !== rear && [ -rear, rear ].map(d => dot(d, '#ffa726', `r${d}`))}
        </svg>
    );
};

const LakeHpSettings: FC<LakeHpSettingsProps> = ({ config, onChange }) => {
    const { api } = useApi();
    const [ status, setStatus ] = useState<LakeHpStatus | null>(null);

    useEffect(() => {
        if (!api) return;
        api.axiosInstance.get<LakeHpStatus>(`${api.basePath}/LakeHp`, {
            headers: { Authorization: api.authorizationHeader }
        }).then(res => setStatus(res.data))
            .catch(() => setStatus(null));
    }, [ api ]);

    const surround = toNumber(config.LakeHpSurroundAzimuth, 118);
    const rear = toNumber(config.LakeHpRearAzimuth, 118);
    const preset = presetFor(surround, rear);

    const onPresetChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const p = PRESETS[e.target.value as keyof typeof PRESETS];
        if (p) onChange({ LakeHpSurroundAzimuth: p.surround, LakeHpRearAzimuth: p.rear });
    }, [ onChange ]);

    const onSurroundChange = useCallback((_e: Event, value: number | number[]) => {
        onChange({ LakeHpSurroundAzimuth: value as number });
    }, [ onChange ]);

    const onRearChange = useCallback((_e: Event, value: number | number[]) => {
        onChange({ LakeHpRearAzimuth: value as number });
    }, [ onChange ]);

    const onFieldChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onChange({ [e.target.name]: e.target.value } as LakeHpEncodingOptions);
    }, [ onChange ]);

    const onMatrixLfeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ LakeHpMatrixLfe: e.target.checked });
    }, [ onChange ]);

    let statusAlert = null;
    if (status?.HeadphonesAvailable) {
        statusAlert = <Alert severity='success'>{globalize.translate('LakeHpStatusReady', status.FilterPath ?? '')}</Alert>;
    } else if (status && !status.FfmpegSupported) {
        statusAlert = <Alert severity='warning'>{globalize.translate('LakeHpStatusNoFfmpeg')}</Alert>;
    } else if (status && !status.FilterFound) {
        statusAlert = <Alert severity='warning'>{globalize.translate('LakeHpStatusNoFilters')}</Alert>;
    }

    return (
        <Stack spacing={3}>
            <Typography variant='h2'>{globalize.translate('HeaderLakeHpServer')}</Typography>
            <Typography>{globalize.translate('LakeHpServerHelp')}</Typography>
            {statusAlert}

            <TextField
                name='LakeHpFilterPath'
                value={config.LakeHpFilterPath ?? ''}
                onChange={onFieldChange}
                label={globalize.translate('LabelLakeHpFilterPath')}
                helperText={globalize.translate('LabelLakeHpFilterPathHelp')}
            />

            <TextField
                name='LakeHpRoom'
                value={String(config.LakeHpRoom ?? 2)}
                onChange={onFieldChange}
                label={globalize.translate('LabelLakeHpRoom')}
                select
            >
                <MenuItem value='1'>{globalize.translate('LakeHpRoomSmall')}</MenuItem>
                <MenuItem value='2'>{globalize.translate('LakeHpRoomMedium')}</MenuItem>
                <MenuItem value='3'>{globalize.translate('LakeHpRoomLarge')}</MenuItem>
            </TextField>

            <TextField
                value={preset}
                onChange={onPresetChange}
                label={globalize.translate('LabelLakeHpPreset')}
                select
            >
                <MenuItem value='Factory'>{globalize.translate('LakeHpPresetFactory')}</MenuItem>
                <MenuItem value='Theater'>{globalize.translate('LakeHpPresetTheater')}</MenuItem>
                <MenuItem value='Custom' disabled>{globalize.translate('LakeHpPresetCustom')}</MenuItem>
            </TextField>

            <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                <SpeakerDiagram surround={surround} rear={rear} />
                <Stack spacing={2} sx={{ flex: 1, minWidth: 240 }}>
                    <FormControl>
                        <FormLabel>{globalize.translate('LabelLakeHpSurroundAngle')}: {surround}°</FormLabel>
                        <Slider
                            value={surround}
                            min={MIN_ANGLE}
                            max={MAX_ANGLE}
                            step={1}
                            marks={[ { value: 118 }, { value: 136 } ]}
                            onChange={onSurroundChange}
                            sx={{ color: '#4caf50' }}
                        />
                    </FormControl>
                    <FormControl>
                        <FormLabel>{globalize.translate('LabelLakeHpRearAngle')}: {rear}°</FormLabel>
                        <Slider
                            value={rear}
                            min={MIN_ANGLE}
                            max={MAX_ANGLE}
                            step={1}
                            marks={[ { value: 118 }, { value: 150 } ]}
                            onChange={onRearChange}
                            sx={{ color: '#ffa726' }}
                        />
                    </FormControl>
                    <FormHelperText>{globalize.translate('LakeHpAngleHelp')}</FormHelperText>
                </Stack>
            </Box>

            <Typography variant='h2'>{globalize.translate('HeaderLakeHpMatrix')}</Typography>
            <Typography>{globalize.translate('LakeHpMatrixHelp')}</Typography>
            {status && !status.MatrixSurroundAvailable && (
                <Alert severity='warning'>{globalize.translate('LakeHpMatrixUnavailable')}</Alert>
            )}

            <TextField
                name='LakeHpMatrixMode'
                value={config.LakeHpMatrixMode || 'plii'}
                onChange={onFieldChange}
                label={globalize.translate('LabelLakeHpMatrixMode')}
                select
            >
                <MenuItem value='plii'>{globalize.translate('LakeHpMatrixPlii')}</MenuItem>
                <MenuItem value='pl'>{globalize.translate('LakeHpMatrixPl')}</MenuItem>
            </TextField>

            <FormControl>
                <FormControlLabel
                    label={globalize.translate('LabelLakeHpMatrixLfe')}
                    control={
                        <Checkbox
                            checked={config.LakeHpMatrixLfe ?? true}
                            onChange={onMatrixLfeChange}
                        />
                    }
                />
                <FormHelperText>{globalize.translate('LabelLakeHpMatrixLfeHelp')}</FormHelperText>
            </FormControl>
        </Stack>
    );
};

export default LakeHpSettings;
