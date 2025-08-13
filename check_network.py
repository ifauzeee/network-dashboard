# File: check_network.py
import psutil
import time

def main():
    """
    Skrip ini akan mencetak lalu lintas jaringan per detik untuk setiap antarmuka
    dan menyimpan semua riwayat tanpa menghapus layar.
    """
    print("Memulai tes diagnostik jaringan... Tekan CTRL+C untuk berhenti.")
    print("="*60)
    
    last_counters = psutil.net_io_counters(pernic=True)
    
    try:
        while True:
            time.sleep(1)
            current_counters = psutil.net_io_counters(pernic=True)
            
            # Cetak header waktu setiap loop
            print(f"\n[{time.strftime('%H:%M:%S')}] Data Lalu Lintas Jaringan per Detik")
            print("-" * 60)
            
            found_traffic = False
            for nic, current_io in current_counters.items():
                if nic in last_counters:
                    last_io = last_counters[nic]
                    
                    # Hitung kecepatan dalam Mbps
                    download_speed = ((current_io.bytes_recv - last_io.bytes_recv) * 8) / (1024 * 1024)
                    upload_speed = ((current_io.bytes_sent - last_io.bytes_sent) * 8) / (1024 * 1024)
                    
                    # Tampilkan semua antarmuka (atau hanya yang aktif)
                    print(f"  -> Antarmuka: {nic}")
                    print(f"     Download: {download_speed:.2f} Mbps")
                    print(f"     Upload:   {upload_speed:.2f} Mbps")
                    print("-" * 20)
                    if download_speed > 0.01 or upload_speed > 0.01:
                        found_traffic = True
                        
            if not found_traffic:
                print("Tidak ada lalu lintas jaringan signifikan.")
            
            last_counters = current_counters

    except KeyboardInterrupt:
        print("\nTes diagnostik dihentikan.")
    except Exception as e:
        print(f"\nTerjadi kesalahan: {e}")

if __name__ == "__main__":
    main()
