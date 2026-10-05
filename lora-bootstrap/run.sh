#!/bin/bash
# 《九域旅人》画风 LoRA 训练启动脚本（SDXL / Animagine XL 系底模）
# 数据集: VPS 主用, Google Drive 备用 | 底模: hf-mirror
set -e
# 把全部输出同时记到 /data/run.log(平台云盘, 任务结束后仍可查看), 定位黑盒失败
mkdir -p /data 2>/dev/null && touch /data/run.log 2>/dev/null && exec >>/data/run.log 2>&1 || echo "WARN: cannot write /data/run.log"
echo "run.sh started at $(date)"

echo "--- connectivity self-test ---"
for target in "141.11.50.249 8901" "hf-mirror.com 443" "github.com 443" "drive.google.com 443" "pypi.org 443"; do
  set -- $target
  if timeout 8 bash -c "echo > /dev/tcp/$1/$2" 2>/dev/null; then echo "$1:$2 OK"; else echo "$1:$2 FAIL"; fi
done

VPS="http://141.11.50.249:8901"
# 轻量遥测: 让容器向 VPS 报进度(平台不保留日志时也能定位卡在哪一步), 失败不影响主流程
ping() { curl -s --max-time 10 "$VPS/ping?stage=$1" -o /dev/null || true; }

echo "=== [0/5] env ==="
ping start
nvidia-smi --query-gpu=name,memory.total --format=csv 2>/dev/null | head -3 || echo "no nvidia-smi"
df -h /tmp /opt /data 2>/dev/null | head -8
python3 --version

echo "=== [1/5] dataset ==="
ping dataset_start
cd /tmp
if ! wget -q --tries=3 --timeout=60 -O /tmp/dataset.zip "$VPS/jiuyu-lora-dataset-288.zip"; then
  echo "VPS download failed, trying Google Drive fallback..."
  pip install -q gdown
  gdown --id 1PhBuvNrVaEysdSspeac111oAUAYIYy3h -O /tmp/dataset.zip
fi
[ -s /tmp/dataset.zip ] || { echo "FATAL: dataset download failed"; exit 1; }
ls -lh /tmp/dataset.zip
mkdir -p /opt/train && unzip -q -o /tmp/dataset.zip -d /opt/train
# kohya DreamBooth 目录重复数规则: 无数字前缀的目录会被忽略, 统一加前缀
[ -d "/opt/train/终版/脚脚" ] && mv "/opt/train/终版/脚脚" "/opt/train/终版/01_脚脚"
# 统一加触发词 jiuyu_style
find /opt/train -name "*.txt" -exec sed -i 's/^/jiuyu_style, /' {} \;
echo "images: $(find /opt/train \( -name '*.jpg' -o -name '*.jpeg' -o -name '*.png' -o -name '*.webp' \) | wc -l)"
ls /opt/train/终版/

echo "=== [2/5] kohya sd-scripts ==="
ping kohya_start
if [ -f /code/workspace/sdxl_train_network.py ]; then
  SD=/code/workspace
elif [ -f /code/workspace/sd-scripts/sdxl_train_network.py ]; then
  SD=/code/workspace/sd-scripts
else
  git clone --depth 1 https://github.com/kohya-ss/sd-scripts /opt/sd-scripts
  SD=/opt/sd-scripts
fi
echo "using sd-scripts at $SD"
cd "$SD" && pip install -q -r requirements.txt
python3 -c "import torch; print('torch', torch.__version__, 'cuda', torch.cuda.is_available())"

echo "=== [3/5] base model (Animagine XL 4.0) ==="
ping model_start
mkdir -p /opt/models
MODEL=/opt/models/animagine-xl-4.0.safetensors
if [ ! -s "$MODEL" ]; then
  wget -q --tries=3 --timeout=120 -O "$MODEL" \
    "https://hf-mirror.com/cagliostrolab/animagine-xl-4.0/resolve/main/animagine-xl-4.0.safetensors" || \
  wget -q --tries=2 --timeout=120 -O "$MODEL" \
    "https://huggingface.co/cagliostrolab/animagine-xl-4.0/resolve/main/animagine-xl-4.0.safetensors"
fi
[ -s "$MODEL" ] || { echo "FATAL: base model download failed"; exit 1; }
ls -lh "$MODEL"

echo "=== [4/5] training (SDXL LoRA) ==="
ping train_start
mkdir -p /data/output /data/logs
cd "$SD"
accelerate launch --num_cpu_threads_per_process=4 sdxl_train_network.py \
  --pretrained_model_name_or_path="$MODEL" \
  --train_data_dir=/opt/train/终版 \
  --resolution=1024,1024 --enable_bucket --min_bucket_reso=256 --max_bucket_reso=1536 \
  --train_batch_size=4 --max_train_epochs=10 \
  --learning_rate=1e-4 --unet_lr=1e-4 --text_encoder_lr 5e-5 5e-5 \
  --lr_scheduler=cosine_with_restarts --lr_warmup_steps=100 --optimizer_type=AdamW \
  --network_module=networks.lora --network_dim=32 --network_alpha=16 \
  --mixed_precision=bf16 --sdpa --cache_latents --cache_latents_to_disk \
  --caption_extension=.txt --shuffle_caption --keep_tokens=1 --max_token_length=225 \
  --seed=1337 --save_every_n_epochs=2 --save_model_as=safetensors \
  --output_dir=/data/output --output_name=jiuyu-style --logging_dir=/data/logs

echo "=== [5/5] done ==="
ping done
ls -lh /data/output/
echo "TRAINING_DONE"
